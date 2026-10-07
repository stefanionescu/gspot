import { parse } from 'smol-toml';
import { posix } from 'node:path';
import { emptyResult } from '#cli/execution/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { readText, readSource } from '#cli/platform/source.ts';
import { RAN_STATUSES } from '#cli/config/execution/runtime.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { docstringOf, parsePythonModule } from '#cli/parsers/python.ts';
import type { PythonDocstringStyle } from '#cli/types/parsers/python.ts';
import { docstringStyleSchema } from '#cli/parsers/schema/python/docstrings.ts';
import type { DocstringConfiguration } from '#cli/types/checks/language/python.ts';

import {
    NUMPY_DOCSTRING,
    PYTHON_MANIFEST,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python.ts';

async function sourceStyle(session: ToolSession, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(
        path,
        readSource(session.root, path, session.reads).toString('utf8'),
        session,
    );
    try {
        for (const node of module.tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
            const docstring = docstringOf(node);
            if (docstring === undefined) continue;
            if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
            if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
        }
        return undefined;
    } finally {
        module.tree.delete();
    }
}

async function docstringGroups(session: ToolSession, files: TrackedFile[], declared: PythonDocstringStyle | undefined) {
    const groups = new Map<PythonDocstringStyle | undefined, TrackedFile[]>();
    for (const file of files) {
        const style = declared ?? (await sourceStyle(session, file.path));
        const group = groups.get(style) ?? [];
        group.push(file);
        groups.set(style, group);
    }
    return groups;
}

/**
 * Preserve authored pydoclint options, then inherit Ruff style and avoid repeating signature types in prose.
 * @param text the scoped Python project configuration
 * @param convention the scope's Ruff docstring convention
 * @returns native arguments and the declared style, when one exists
 */
export function docstringConfiguration(text: string, convention?: unknown): DocstringConfiguration {
    const { tool } = docstringStyleSchema.parse(parse(text));
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const authored = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const defaults = PYDOCLINT_TYPE_OPTIONS.filter((name) => !authored.has(name)).flatMap((name) => [
        `--${name}`,
        'false',
    ]);
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

/**
 * Check docstrings with their declared style, or detect Google and NumPy sections in source docstrings.
 * @param session the repository and installed tools
 * @param planned the scoped docstring check
 * @returns findings across style batches, preserving earlier findings if a later command fails
 */
export async function pydoclint(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const configured = docstringConfiguration(
        readText(session.root, posix.join(planned.scope.scope.path, PYTHON_MANIFEST)) ?? '',
        planned.scope.view.settings['tools.ruff.docstring_convention'],
    );
    const groups = await docstringGroups(session, planned.files, configured.style);
    const report = emptyResult(planned);
    for (const [style, files] of groups) {
        const result = await runCheckCommand(
            session,
            { ...planned, files },
            {
                command: [...configured.command, '--style', style ?? PYDOCLINT_DEFAULT_STYLE],
            },
        );
        if (groups.size === 1) return result;
        report.duration += result.duration;
        report.findings.push(...result.findings);
        if (!RAN_STATUSES.has(result.status))
            return {
                ...result,
                fileCount: report.fileCount,
                duration: report.duration,
                findings: report.findings,
            };
        if (result.status === 'failed') report.status = 'failed';
    }
    return report;
}
