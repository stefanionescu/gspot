import {
    GOOGLE_DOCSTRING,
    NUMPY_DOCSTRING,
    PYDOCLINT_ALL_LEVEL_OPTIONS,
    PYDOCLINT_COMMAND,
    PYDOCLINT_DEFAULT_STYLE,
    PYDOCLINT_STYLE_FLAG,
    PYDOCLINT_TYPE_OPTIONS,
} from '#cli/config/configurations/python.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { runCommandBatches } from '#cli/engine/tool-runs/check.ts';
import { findDocstring, parsePythonModule } from '#cli/parsers/code/python.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { docstringStyleSchema } from '#cli/schemas/configurations.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { type PydoclintOptions, type PythonDocstringStyle } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { Level } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

const RAISES_MISMATCH_RULE = 'DOC503';

const RAISES_MISMATCH_HELP =
    'Under `Raises:`, list each name that the finding prints for the body. pydoclint reads the name that follows `raise`, so for `raise build_error(...)` or `raise error` it expects the function or the variable, not the exception class.';

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, readText(session.cache, path), session);
    using tree = module.tree;
    for (const node of tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
        const docstring = findDocstring(node);
        if (docstring === undefined) continue;
        if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
        if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
    }
    return undefined;
}

async function groupByDocstringStyle(
    session: Session,
    files: TrackedFile[],
    configured: PythonDocstringStyle | undefined,
) {
    const styled: Array<{ file: TrackedFile; style: PythonDocstringStyle | undefined }> = [];
    for (const file of files) {
        const style = configured ?? (await detectDocstringStyle(session, file.path));
        styled.push({ file, style });
    }
    return new Map(
        Map.groupBy(styled, ({ style }) => style)
            .entries()
            .map(([style, group]) => [style, group.map(({ file }) => file)]),
    );
}

function parsePydoclintOptions(path: string, text: string, convention: unknown, level: Level): PydoclintOptions {
    const { tool } = parseTomlFile(path, text, docstringStyleSchema);
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const written = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const options =
        level === 'all' ? [...PYDOCLINT_TYPE_OPTIONS, ...PYDOCLINT_ALL_LEVEL_OPTIONS] : PYDOCLINT_TYPE_OPTIONS;
    const defaults = options.flatMap((name) => (written.has(name) ? [] : [`--${name}`, 'false']));
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

async function checkPydoclint(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const configured = parsePydoclintOptions(
        pyproject,
        findText(session.cache, pyproject) ?? '',
        planned.scope.settings.tables.python?.docstring_convention,
        session.settings.level,
    );
    const groups = await groupByDocstringStyle(session, planned.files, configured.style);
    const result = await runCommandBatches(
        session,
        planned,
        [...groups].map(([style, files]) => ({
            files,
            command: [...configured.command, PYDOCLINT_STYLE_FLAG, style ?? PYDOCLINT_DEFAULT_STYLE],
        })),
    );
    return {
        ...result,
        findings: result.findings.map((finding) =>
            finding.rule === RAISES_MISMATCH_RULE ? { ...finding, help: RAISES_MISMATCH_HELP } : finding,
        ),
    };
}

export const PYTHON_PYDOCLINT_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/pydoclint': { run: checkPydoclint },
};
