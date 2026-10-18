import { buildFinding } from '#cli/runs/finding.ts';
import { readScripts } from '#cli/checks/bash/scripts.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/bash.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Reports each line that embeds another runtime.
 * @param input the scope scripts to read.
 * @returns the findings.
 */
export async function checkBashInlineScripts(input: CheckInput): Promise<Finding[]> {
    const scripts = await readScripts(input);
    return scripts.flatMap((file) =>
        file.code.flatMap((line, position) => {
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) return [];
            return [
                buildFinding(
                    input,
                    { file: file.path, line: position + 1 },
                    'runtime-embed',
                    `This line carries ${embed[1]}; put it in its own file.`,
                ),
            ];
        }),
    );
}
