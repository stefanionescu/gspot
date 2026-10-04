import { parse } from 'smol-toml';
import { posix } from 'node:path';
import { readText } from '#cli/platform/source.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import { pyprojectSchema } from '#cli/parsers/schema/python/style.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/runtime.ts';
import { PYTHON_MANIFEST, PYDOCLINT_COMMAND } from '#cli/config/checks/language/python.ts';

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
 * Runs pydoclint, adding --style from the Ruff docstring convention when pydoclint sets none.
 * @param session the repository and installed tools.
 * @param planned the scoped docstring check.
 * @returns the native findings and command status.
 */
export async function pydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const style = docstringStyle(
        readText(session.root, posix.join(planned.scope.scope.path, PYTHON_MANIFEST)) ?? '',
        planned.scope.view.settings['tools.ruff.docstring_convention'],
    );
    return await runCommandCheck(session, planned, {
        command: [...PYDOCLINT_COMMAND, ...(style === undefined ? [] : ['--style', style])],
    });
}
