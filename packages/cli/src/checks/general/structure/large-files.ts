import { findingAt } from '#cli/checks/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { BYTES_PER_KB } from '#cli/config/platform/runtime.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per tracked file over `limits.file_kb` that is neither under LFS nor declared.
 * @param input the check input
 * @returns the findings
 */
export function largeFiles(input: CheckInput): Finding[] {
    const limitKb = input.view.limit('file_kb');
    if (limitKb === undefined) return [];
    const isDeclared = pathMatcher(input.policyFiles.policy.declarations.flatMap((entry) => entry.paths));
    if (input.repositoryFiles === undefined)
        throw new Error(
            'The large-files check needs the full list of tracked files. Its manifest must say runs = "once".',
        );
    return input.repositoryFiles
        .filter(
            (file) =>
                file.size > limitKb * BYTES_PER_KB &&
                !isDeclared(file.path) &&
                input.attributes.get(file.path)?.['filter'] !== 'lfs',
        )
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'size',
                `${String(Math.round(file.size / BYTES_PER_KB))} KB is over the ${String(limitKb)} KB limit; move it to LFS or declare it with a reason.`,
            ),
        );
}
