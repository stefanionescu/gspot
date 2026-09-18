// A file stem equal to a sibling directory. Searched: ls-lint; it names files and folders apart.
import type { Analysis } from '#types/structure.ts';
import { directoryOf, directoryTree, stemOf } from '#cli/structure/directories.ts';

/**
 * One finding per file whose stem is also a sibling folder's name.
 * @param context the check context
 * @returns the findings
 */
export const fileDirectoryCollision: Analysis = (context) => {
    const tree = directoryTree(context.input.session.repository.files);
    const findings = context.files.flatMap((file) => {
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
    return Promise.resolve(findings);
};
