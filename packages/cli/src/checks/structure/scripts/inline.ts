import { findingAt } from '#cli/checks/result.ts';
import { RUNTIME_EMBEDS } from '#cli/config/checks/structure.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks.ts';

/**
 * One finding per line that embeds another runtime.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptInline: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) =>
        file.lines.flatMap((line, position) => {
            if (line.trimStart().startsWith('#')) return [];
            const embed = RUNTIME_EMBEDS.find(([pattern]) => pattern.test(line));
            if (embed === undefined) return [];
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: position + 1 },
                    'runtime-embed',
                    `This line carries ${embed[1]}; put it in its own file.`,
                ),
            ];
        }),
    );
};
