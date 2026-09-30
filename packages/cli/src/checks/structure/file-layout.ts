import { findingAt } from '#cli/checks/result.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks.ts';
import { stemOf, directoryOf, directoryTree } from '#cli/checks/structure/directories.ts';

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
            findingAt(
                context.input,
                { file: file.path, line: 1 },
                'stem-collision',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
};
