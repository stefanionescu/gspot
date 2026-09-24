// A shell script over the code-line ceiling. Searched: shellcheck, shfmt; neither counts lines.
import type { Analysis } from '#cli/types/structure.ts';
import { codeLines } from '#cli/structure/code-lines.ts';

/**
 * One finding per script whose code lines exceed limits.bash.file_lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const fileLength: Analysis = async (context, scripts) => {
    const ceiling = context.limit('file_lines', 'bash');
    if (ceiling === undefined) return [];
    const index = await scripts();
    return index.files.flatMap((file) => {
        const count = codeLines(file.lines).length;
        if (count <= ceiling) return [];
        return [
            context.report(
                file.path,
                1,
                'file-lines',
                `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`,
            ),
        ];
    });
};
