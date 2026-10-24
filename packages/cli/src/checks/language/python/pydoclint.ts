import { type Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandGroups } from '#cli/runs/command/check.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { findCachedText, readCachedText } from '#cli/system/files/reads.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { findDocstring, parsePythonModule } from '#cli/parsers/code/python.ts';
import { docstringStyleSchema } from '#cli/schemas/checks/language/python/pydoclint.ts';
import { type PydoclintOptions, type PythonDocstringStyle } from '#cli/types/checks/language/python.ts';

import {
    NUMPY_DOCSTRING,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_STYLE_FLAG,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python/pydoclint.ts';

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, readCachedText(session.reads, path), session);
    try {
        for (const node of module.tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
            const docstring = findDocstring(node);
            if (docstring === undefined) continue;
            if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
            if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
        }
        return undefined;
    } finally {
        module.tree.delete();
    }
}

async function groupByDocstringStyle(
    session: Session,
    files: TrackedFile[],
    configured: PythonDocstringStyle | undefined,
) {
    const styled: { file: TrackedFile; style: PythonDocstringStyle | undefined }[] = [];
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
function parsePydoclintOptions(path: string, text: string, convention: unknown): PydoclintOptions {
    const { tool } = parseTomlFile(path, text, docstringStyleSchema);
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const written = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const defaults = PYDOCLINT_TYPE_OPTIONS.flatMap((name) => (written.has(name) ? [] : [`--${name}`, 'false']));
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

/**
Runs pydoclint with the declared docstring style, or with the style each file uses.

@param session the repository and installed tools.
@param planned the docstring check for one scope.
@returns the check result, with earlier findings kept when a later batch fails.
*/
export async function checkPythonPydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const configured = parsePydoclintOptions(
        joinScope(planned.scope.folder.path, PYPROJECT_TOML),
        findCachedText(session.reads, joinScope(planned.scope.folder.path, PYPROJECT_TOML)) ?? '',
        planned.scope.settings.values['tools.ruff']?.docstring_convention,
    );
    const groups = await groupByDocstringStyle(session, planned.files, configured.style);
    return runCommandGroups(
        session,
        planned,
        [...groups].map(([style, files]) => ({
            files,
            command: [...configured.command, PYDOCLINT_STYLE_FLAG, style ?? PYDOCLINT_DEFAULT_STYLE],
        })),
    );
}
