import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { stemOf, directoryOf, directoryTree } from '#cli/platform/paths.ts';
import { structureSources } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per file whose stem is also a sibling folder's name.
 * @param input the check context
 * @returns the findings
 */
export const stemCollisions: Engine = (input) => {
    const files = structureSources(input);
    const tree = directoryTree(input.files);
    return files.flatMap((file) => {
        const stem = stemOf(file.path);
        const siblings = tree.get(directoryOf(file.path)) ?? [];
        if (siblings.every((entry) => !(entry.kind === 'dir' && entry.name === stem))) return [];
        return [
            findingAt(
                input,
                { file: file.path, line: 1 },
                'stem-collision',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
};
