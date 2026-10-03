import { z } from 'zod';
import { parse } from 'smol-toml';
import { posix } from 'node:path';
import { readText } from '#cli/platform/filesystem.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { PYDOCLINT_COMMAND } from '#cli/config/checks/language/python.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';

const pyprojectSchema = z.object({
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
 * Carries the Ruff docstring convention only when pydoclint has no explicit style.
 * @param text the scoped Python project configuration.
 * @param convention the tools.ruff.docstring_convention setting of the scope.
 * @returns a supported style, or undefined to preserve native configuration and defaults.
 */
export function docstringStyle(text: string, convention?: unknown): 'google' | 'numpy' | undefined {
    const { tool } = pyprojectSchema.parse(parse(text));
    if ('style' in tool.pydoclint) return undefined;
    const style = tool.ruff.lint.pydocstyle.convention ?? convention;
    return style === 'google' || style === 'numpy' ? style : undefined;
}

/**
 * Runs the native docstring checker with the compatible project convention.
 * @param session the repository and execution boundaries.
 * @param planned the scoped docstring check.
 * @returns the native check result with shared batching and error handling.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The check registry runs pydoclint through this function, which adds the style the project names.
export async function pydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const style = docstringStyle(
        readText(session.root, posix.join(planned.scope.scope.path, 'pyproject.toml')) ?? '',
        planned.scope.view.settings['tools.ruff.docstring_convention'],
    );
    return await runToolCheck(session, planned, [
        ...PYDOCLINT_COMMAND,
        ...(style === undefined ? [] : ['--style', style]),
    ]);
}
