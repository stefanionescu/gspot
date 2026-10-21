import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { extractStem, extractParentFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/structure/folder-tree.ts';

/**
 * Reports each file whose stem matches the name of a sibling folder.
 *
 * @param _session the repository and its tools.
 * @param planned the scope files.
 * @returns the findings.
 */
export function checkFileFolderClashes(_session: Session, planned: PlannedCheck): Finding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    return files.flatMap((file) => {
        const stem = extractStem(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
        if (siblings.every((entry) => !(entry.kind === 'folder' && entry.name === stem))) return [];
        return [
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'stem-collision',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
}
