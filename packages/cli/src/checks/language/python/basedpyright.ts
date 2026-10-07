// The exclusions of the basedpyright type check, each of which must still match a tracked file.
import { findingAt } from '#cli/checks/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';

/**
 * Every path the type check leaves out still exists, so the list of exclusions never outlives its files.
 * @param input the check input
 * @returns one finding for each exclusion that matches no tracked file
 */
export function staleExclusions(input: CheckInput): Finding[] {
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
            { file: POLICY_FILE, line: 1 },
            'stale-exclusion',
            `tools.basedpyright.exclude names ${pattern}, which matches no tracked file.`,
        ),
    );
}
