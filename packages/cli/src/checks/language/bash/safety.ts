import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/contracts.ts';
import { SAFETY_LINE_RULES, SAFETY_OWNER_RULES } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per unsafe process kill or removal; all also reports discarded failures.
 * @param input the check context
 * @returns the findings
 */
export const safety: BuiltInCheck = async (input) => {
    const rules = [...(input.policyFiles.policy.level === 'all' ? SAFETY_LINE_RULES : []), ...SAFETY_OWNER_RULES];
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.code.flatMap((code, position) => {
            const isCleanup = file.temporaryPaths.some((temporary) => temporary.cleanupLines.includes(position + 1));
            return rules
                .filter(([pattern]) => pattern.test(code))
                .filter(([, rule]) => rule !== 'recursive-remove' || !isCleanup)
                .map(([, rule, text]) =>
                    findingAt(input, { file: file.path, line: position + 1 }, rule, `Here ${text}.`),
                );
        }),
    );
};
