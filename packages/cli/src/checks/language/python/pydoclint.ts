import { z } from 'zod';
import { posix } from 'node:path';
import { parse } from 'smol-toml';
import type { SchemaShape } from '#cli/types/objects.ts';
import { readText, readSource } from '#cli/system/file-reads.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCommandGroups } from '#cli/execution/command/check.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { docstringOf, parsePythonModule } from '#cli/parsers/python.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { type PythonDocstringStyle, type DocstringConfiguration } from '#cli/types/checks/language.ts';

import {
    NUMPY_DOCSTRING,
    DOCSTRING_STYLES,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_STYLE_FLAG,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python.ts';

async function sourceStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
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
async function docstringGroups(session: Session, files: TrackedFile[], declared: PythonDocstringStyle | undefined) {
    const groups = new Map<PythonDocstringStyle | undefined, TrackedFile[]>();
    for (const file of files) {
        const style = declared ?? (await sourceStyle(session, file.path));
        const group = groups.get(style) ?? [];
        group.push(file);
        groups.set(style, group);
    }
    return groups;
}
const docstringStyleSchema = z.object({
    tool: z
        .object({
            pydoclint: z
                .object({ style: z.enum(DOCSTRING_STYLES).optional() } satisfies SchemaShape<{
                    style?: PythonDocstringStyle | undefined;
                }>)
                .catchall(z.unknown())
                .default({}),
            ruff: z
                .object({
                    lint: z
                        .object({
                            pydocstyle: z
                                .object({ convention: z.unknown().optional() } satisfies SchemaShape<{
                                    convention?: unknown;
                                }>)
                                .default({}),
                        } satisfies SchemaShape<{ pydocstyle: { convention?: unknown } }>)
                        .default({ pydocstyle: {} }),
                } satisfies SchemaShape<{ lint: { pydocstyle: { convention?: unknown } } }>)
                .default({ lint: { pydocstyle: {} } }),
        } satisfies SchemaShape<{
            pydoclint: { style?: PythonDocstringStyle | undefined } & Record<string, unknown>;
            ruff: { lint: { pydocstyle: { convention?: unknown } } };
        }>)
        .default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
} satisfies SchemaShape<{
    tool: {
        pydoclint: { style?: PythonDocstringStyle | undefined } & Record<string, unknown>;
        ruff: { lint: { pydocstyle: { convention?: unknown } } };
    };
}>);
/**
 * Preserve written pydoclint options, then inherit Ruff style and avoid repeating signature types in prose.
 * @param text the Python project configuration for one scope.
 * @param convention the scope's Ruff docstring convention.
 * @returns arguments and the declared style, when one exists.
 */
export function docstringConfiguration(text: string, convention?: unknown): DocstringConfiguration {
    const { tool } = docstringStyleSchema.parse(parse(text));
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const written = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const defaults = PYDOCLINT_TYPE_OPTIONS.filter((name) => !written.has(name)).flatMap((name) => [
        `--${name}`,
        'false',
    ]);
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}
/**
 * Check docstrings with their declared style, or detect Google and NumPy sections in source docstrings.
 * @param session the repository and installed tools.
 * @param planned the docstring check for one scope.
 * @returns findings across style batches, preserving earlier findings if a later command fails.
 */
export async function pydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const configured = docstringConfiguration(
        readText(session.root, posix.join(planned.scope.scope.path, PYPROJECT_TOML)) ?? '',
        planned.scope.view.values['tools.ruff']?.docstring_convention,
    );
    const groups = await docstringGroups(session, planned.files, configured.style);
    return runCommandGroups(
        session,
        planned,
        [...groups].map(([style, files]) => ({
            files,
            command: [...configured.command, PYDOCLINT_STYLE_FLAG, style ?? PYDOCLINT_DEFAULT_STYLE],
        })),
    );
}
