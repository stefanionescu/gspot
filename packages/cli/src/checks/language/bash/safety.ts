import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { SAFETY_LINE_RULES, SAFETY_OWNER_RULES } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per line that discards a failure, sources state, or sweeps processes or trees outside an owner.
 * @param input the check context
 * @returns the findings
 */
export const safety: Engine = async (input) => {
    const owners = input.view.settings['bash.safety_owners'] as string[];
    const isOwner = pathMatcher(owners);
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.code.flatMap((code, position) => {
            const rules = [...SAFETY_LINE_RULES, ...(isOwner(file.path) ? [] : SAFETY_OWNER_RULES)];
            return rules
                .filter(([pattern]) => pattern.test(code))
                .map(([, rule, text]) =>
                    findingAt(input, { file: file.path, line: position + 1 }, rule, `Here ${text}.`),
                );
        }),
    );
};
