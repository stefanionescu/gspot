import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { BYTES_PER_KB } from '#cli/config/platform/platform.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/**
 * One finding per tracked file over `limits.file_kb` that is neither under LFS nor declared.
 * @param input the engine input
 * @returns the findings
 */
export function largeFiles(input: EngineInput): Finding[] {
    const limitKb = input.view.limit('file_kb');
    if (limitKb === undefined) return [];
    const isDeclared = pathMatcher(input.policyFiles.policy.declarations.flatMap((entry) => entry.paths));
    if (input.repositoryFiles === undefined) throw new Error('Large-file validation requires once-only execution.');
    return input.repositoryFiles
        .filter(
            (file) =>
                file.size > limitKb * BYTES_PER_KB &&
                !isDeclared(file.path) &&
                !input.attributes.some(
                    (rule) =>
                        rule.matcher(file.path) &&
                        rule.attributes.some((attribute) => attribute.startsWith('filter=lfs')),
                ),
        )
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'over-limit',
                `${String(Math.round(file.size / BYTES_PER_KB))} KB is over the ${String(limitKb)} KB limit; move it to LFS or declare it with a reason.`,
            ),
        );
}
