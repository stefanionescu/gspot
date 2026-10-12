import { findingAt } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per line that embeds another runtime.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashInlineScripts(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    return index.flatMap((file) =>
        file.code.flatMap((line, position) => {
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
}
