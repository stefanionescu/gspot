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
    return index.files.flatMap((file) =>
        file.lines.flatMap((line, position) => {
            if (line.trimStart().startsWith('#')) return [];
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            return embed === undefined
                ? []
                : [
                      context.report(
                          file.path,
                          position + 1,
                          'runtime-embed',
                          `This line carries ${embed[1]}; put it in its own file.`,
                      ),
                  ];
        }),
    );
};
