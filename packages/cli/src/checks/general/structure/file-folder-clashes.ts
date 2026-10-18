import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { extractStem, extractParentFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';

/**
 * Reports each file whose stem matches the name of a sibling folder.
 * @param input the scope files.
 * @returns the findings.
 */
export function checkFileFolderClashes(input: CheckInput): Finding[] {
    const files = listCodeFiles(input);
    const tree = buildFolderTree(input.files);
    return files.flatMap((file) => {
        const stem = extractStem(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
        if (siblings.every((entry) => !(entry.kind === 'folder' && entry.name === stem))) return [];
        return [
            buildFinding(
                input,
                { file: file.path, line: 1 },
                'stem-collision',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
}
