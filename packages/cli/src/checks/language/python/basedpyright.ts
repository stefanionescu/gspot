// The exclusions of the basedpyright type check, each of which must still match a tracked file.

import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/**
 * Every path the type check leaves out still exists, so the list of exclusions never outlives its files.
 * @param input the engine input
 * @returns one finding for each exclusion that matches no tracked file
 */
export function staleExclusions(input: EngineInput): Finding[] {
    const excluded = (input.view.options('tools.basedpyright')['exclude'] as PathAllowance[] | undefined) ?? [];
    const paths = input.files.map((file) => file.path);
    const stale = excluded
        .flatMap((entry) => entry.paths)
        .filter((pattern) => {
            const isMatch = pathMatcher([pattern, `${pattern}/**`]);
            return paths.every((path) => !isMatch(path));
        });
    return stale.map((pattern) =>
        findingAt(
            input,
            { file: 'gspot.toml', line: 1 },
            'stale-exclusion',
            `tools.basedpyright.exclude names ${pattern}, which matches no tracked file.`,
        ),
    );
}
