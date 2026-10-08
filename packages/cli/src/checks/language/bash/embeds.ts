import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/contracts.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per line that embeds another runtime.
 * @param input the check context
 * @returns the findings
 */
export const embeds: BuiltInCheck = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.code.flatMap((line, position) => {
            if (line.trimStart().startsWith('#')) return [];
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: position + 1 },
                    'runtime-embed',
                    `This line carries ${embed[1]}; put it in its own file.`,
                ),
            ];
        }),
    );
};
