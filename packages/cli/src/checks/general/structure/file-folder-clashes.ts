import { buildFinding } from '#cli/checks/finding.ts';
import { extractStem, extractParentFolder } from '#cli/system/paths.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';

/**
 * One finding per file whose stem matches a sibling folder's name.
 * @param input the check context.
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
