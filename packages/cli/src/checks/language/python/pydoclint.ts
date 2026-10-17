import { z } from 'zod';
import { posix } from 'node:path';
import { parse } from '@decimalturn/toml-patch';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCommandGroups } from '#cli/checks/run/command/check.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { readText, readCachedBytes } from '#cli/system/files/reads.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { findDocstring, parsePythonModule } from '#cli/parsers/python.ts';
import { type PydoclintOptions, type PythonDocstringStyle } from '#cli/types/checks/language.ts';

import {
    NUMPY_DOCSTRING,
    DOCSTRING_STYLES,
    GOOGLE_DOCSTRING,
    PYDOCLINT_COMMAND,
    PYDOCLINT_STYLE_FLAG,
    PYDOCLINT_TYPE_OPTIONS,
    PYDOCLINT_DEFAULT_STYLE,
} from '#cli/config/checks/language/python.ts';

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, readCachedBytes(session.reads, path).toString('utf8'), session);
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
    declared: PythonDocstringStyle | undefined,
) {
    const groups = new Map<PythonDocstringStyle | undefined, TrackedFile[]>();
    for (const file of files) {
        const style = declared ?? (await detectDocstringStyle(session, file.path));
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
 * Builds the pydoclint command: keeps written options, takes the Ruff style, and stops docstrings from repeating signature types.
 * @param text the pyproject.toml of the scope.
 * @param convention the Ruff docstring style from the settings.
 * @returns the command, and the style when known.
 */
function parsePydoclintOptions(text: string, convention: unknown): PydoclintOptions {
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
 * Runs pydoclint with the declared docstring style, or with the style each file uses.
 * @param session the repository and installed tools.
 * @param planned the docstring check for one scope.
 * @returns the check result, with earlier findings kept when a later batch fails.
 */
export async function checkPydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const configured = parsePydoclintOptions(
        readText(session.root, posix.join(planned.scope.scope.path, PYPROJECT_TOML)) ?? '',
        planned.scope.view.values['tools.ruff']?.docstring_convention,
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
