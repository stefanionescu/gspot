import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/language/bash.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

/**
 * One finding per line that embeds another runtime.
 * @param input the check context
 * @returns the findings
 */
export const embeds: Engine = async (input) => {
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
