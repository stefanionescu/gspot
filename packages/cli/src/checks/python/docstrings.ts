import { z } from 'zod';
import { parse } from 'smol-toml';
import { posix } from 'node:path';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { DOCSTRING_COMMAND } from '#cli/constants/checks/python.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

const projectSchema = z.object({
    tool: z
        .object({
            pydoclint: z.object({ style: z.unknown().optional() }).default({}),
            ruff: z
                .object({
                    lint: z
                        .object({
                            pydocstyle: z.object({ convention: z.unknown().optional() }).default({}),
                        })
                        .default({ pydocstyle: {} }),
                })
                .default({ lint: { pydocstyle: {} } }),
        })
        .default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
});

/**
 * Carries compatible Ruff conventions only when pydoclint has no explicit style.
 * @param text the scoped Python project configuration.
 * @param adopted the convention preserved by Ruff configuration adoption.
 * @returns a supported style, or undefined to preserve native configuration and defaults.
 */
export function docstringStyle(text: string, adopted?: unknown): 'google' | 'numpy' | undefined {
    const { tool } = projectSchema.parse(parse(text));
    if ('style' in tool.pydoclint) return undefined;
    const style = tool.ruff.lint.pydocstyle.convention ?? adopted;
    return style === 'google' || style === 'numpy' ? style : undefined;
}

/**
 * Runs the native docstring checker with the compatible project convention.
 * @param session the repository and execution boundaries.
 * @param planned the scoped docstring check.
 * @returns the native check result with shared batching and error handling.
 */
export async function checkDocstrings(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const files = openConfinedRoot(session.root);
    let style: 'google' | 'numpy' | undefined;
    try {
        const project = files.read(posix.join(planned.scope.scope.path, 'pyproject.toml'));
        style = docstringStyle(
            project === undefined ? '' : new TextDecoder('utf-8', { fatal: true }).decode(project.bytes),
            planned.scope.view.settings['tools.ruff.docstring_convention'],
        );
    } finally {
        files.close();
    }
    return runToolCheck(session, planned, [...DOCSTRING_COMMAND, ...(style === undefined ? [] : ['--style', style])]);
}
