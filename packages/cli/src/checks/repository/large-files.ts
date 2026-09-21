// A tracked file above the size limit is under LFS or declared, or it is a finding.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { isUnderLfs } from '#cli/repository/natures.ts';
import { FILE_SIZE_KB_DEFAULT } from '#config/integrity.ts';

const KILOBYTE = 1024;

/**
 * One finding per tracked file over `limits.file_size_kb` that is neither under LFS nor declared.
 * @param input the engine input
 * @returns the findings
 */
export function largeFiles(input: EngineInput): Promise<Finding[]> {
    const limitKb = input.view.limit('file_size_kb') ?? FILE_SIZE_KB_DEFAULT;
    const isDeclared = pathMatcher(input.session.policyFiles.policy.declarations.flatMap((entry) => entry.paths));
    const findings = input.session.repository.files
        .filter(
            (file) =>
                file.size > limitKb * KILOBYTE &&
                !isDeclared(file.path) &&
                !isUnderLfs(input.session.repository.attributes, file.path),
        )
        .map((file) => ({
            check: input.spec.name,
            file: file.path,
            line: 1,
            rule: 'over-limit',
            message: `${String(Math.round(file.size / KILOBYTE))} KB is over the ${String(limitKb)} KB limit; move it to LFS or declare it with a reason.`,
            fixable: false,
        }));
    return Promise.resolve(findings);
}
