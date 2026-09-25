import type { Analysis } from '#cli/checks/structure/engine.ts';
import { codeLines } from '#cli/checks/structure/code-lines.ts';
import { directoryOf, directoryTree, stemOf } from '#cli/checks/structure/directories.ts';

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

/**
 * One finding per file whose stem is also a sibling folder's name.
 * @param context the check context
 * @returns the findings
 */
export const fileDirectoryCollision: Analysis = (context) => {
    const tree = directoryTree(context.input.files);
    return context.files.flatMap((file) => {
        const stem = stemOf(file.path);
        const siblings = tree.get(directoryOf(file.path)) ?? [];
        if (siblings.every((entry) => !(entry.kind === 'dir' && entry.name === stem))) return [];
        return [
            context.report(
                file.path,
                1,
                'stem-collision',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
};
