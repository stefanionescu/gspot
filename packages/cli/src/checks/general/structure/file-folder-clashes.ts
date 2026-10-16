import { findingAt } from '#cli/checks/finding.ts';
import { extractStem, extractParentFolder } from '#cli/system/paths.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { directoryTree, structureSources } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per file whose stem matches a sibling folder's name.
 * @param input the check context.
 * @returns the findings.
 */
export function fileFolderClashes(input: CheckInput): Finding[] {
    const files = structureSources(input);
    const tree = directoryTree(input.files);
    return files.flatMap((file) => {
        const stem = extractStem(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
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
}
