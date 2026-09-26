import { codeLines } from '#cli/checks/structure/code-lines.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';

/**
 * One finding per function whose body code lines exceed limits.bash.function_lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const functionLength: Analysis = async (context, scripts) => {
    const ceiling = context.limit('function_lines', 'bash');
    if (ceiling === undefined) return [];
    const index = await scripts();
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const count = codeLines(entry.body).length;
            if (count <= ceiling) return [];
            return [
                context.report(
                    file.path,
                    entry.start,
                    'function-lines',
                    `${entry.name} has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        }),
    );
};
