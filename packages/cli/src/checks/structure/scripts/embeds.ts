import type { Analysis } from '#cli/checks/structure/engine.ts';
import { RUNTIME_EMBEDS } from '#cli/checks/structure/patterns.ts';

/**
 * One finding per line that embeds another runtime.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptEmbeds: Analysis = async (context, scripts) => {
    const index = await scripts();
    const findings = [];
    for (const file of index.files)
        for (const [position, line] of file.lines.entries()) {
            if (line.trimStart().startsWith('#')) continue;
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) continue;
            findings.push(
                context.report(
                    file.path,
                    position + 1,
                    'runtime-embed',
                    `This line carries ${embed[1]}; put it in its own file.`,
                ),
            );
        }
    return findings;
};
