import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { UNCHECKED_CD, SAFETY_LINE_RULES, SAFETY_OWNER_RULES } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per line that discards a failure, sources state, sweeps processes or trees outside an owner, or changes directory unchecked.
 * @param input the check context
 * @returns the findings
 */
export const safety: Engine = async (input) => {
    const owners = input.view.settings['bash.safety_owners'] as string[];
    const isOwner = pathMatcher(owners);
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.code.flatMap((code, position) => {
            const trimmed = code.trim();
            const rules = [...SAFETY_LINE_RULES, ...(isOwner(file.path) ? [] : SAFETY_OWNER_RULES)];
            const found = rules
                .filter(([pattern]) => pattern.test(code))
                .map(([, rule, text]) =>
                    findingAt(input, { file: file.path, line: position + 1 }, rule, `Here ${text}.`),
                );
            if (UNCHECKED_CD.test(trimmed) && !trimmed.includes('||'))
                found.push(
                    findingAt(
                        input,
                        { file: file.path, line: position + 1 },
                        'unchecked-cd',
                        'cd carries an explicit failure path, such as || exit 1.',
                    ),
                );
            return found;
        }),
    );
};
