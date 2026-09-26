import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { isUnderLfs } from '#cli/repository/file-classification.ts';

const KILOBYTE = 1024;

/**
 * One finding per tracked file over `limits.file_size_kb` that is neither under LFS nor declared.
 * @param input the engine input
 * @returns the findings
 */
export function largeFiles(input: EngineInput): Finding[] {
    const limitKb = input.view.limit('file_size_kb') ?? FILE_SIZE_KB_DEFAULT;
    const isDeclared = pathMatcher(input.policyFiles.policy.declarations.flatMap((entry) => entry.paths));
    if (input.repositoryFiles === undefined) throw new Error('Large-file validation requires once-only execution.');
    return input.repositoryFiles
        .filter(
            (file) =>
                file.size > limitKb * KILOBYTE && !isDeclared(file.path) && !isUnderLfs(input.attributes, file.path),
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

const FILE_SIZE_KB_DEFAULT = 1024;
