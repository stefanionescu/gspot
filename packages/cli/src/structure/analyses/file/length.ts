// A shell script over the code-line ceiling. Searched: shellcheck, shfmt; neither counts lines.
import type { Analysis } from '#types/structure.ts';
import { codeLineCount } from '#cli/structure/code-lines.ts';

/**
 * One finding per script whose code lines exceed limits.bash.file_lines.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const fileLength: Analysis = async (context, shell) => {
    const ceiling = context.limit('file_lines', 'bash');
    if (ceiling === undefined) return [];
    const index = await shell();
    return index.files.flatMap((file) => {
        const count = codeLineCount(file.lines);
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
