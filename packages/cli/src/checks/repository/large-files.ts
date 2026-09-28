import { pathMatcher } from '#cli/repository/paths.ts';
import { KILOBYTE } from '#cli/constants/checks/repository.ts';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';

/**
 * One finding per tracked file over `limits.file_size_kb` that is neither under LFS nor declared.
 * @param input the engine input
 * @returns the findings
 */
export function largeFiles(input: EngineInput): Finding[] {
    const limitKb = input.view.limit('file_size_kb');
    if (limitKb === undefined) return [];
    const isDeclared = pathMatcher(input.policyFiles.policy.declarations.flatMap((entry) => entry.paths));
    if (input.repositoryFiles === undefined) throw new Error('Large-file validation requires once-only execution.');
    return input.repositoryFiles
        .filter(
            (file) =>
                file.size > limitKb * KILOBYTE &&
                !isDeclared(file.path) &&
                !input.attributes.some(
                    (rule) =>
                        rule.matcher(file.path) &&
                        rule.attributes.some((attribute) => attribute.startsWith('filter=lfs')),
                ),
        )
        .map((file) => ({
            check: input.spec.name,
            file: file.path,
            line: 1,
            rule: 'over-limit',
            message: `${String(Math.round(file.size / KILOBYTE))} KB is over the ${String(limitKb)} KB limit; move it to LFS or declare it with a reason.`,
            fixable: false,
        }));
}
