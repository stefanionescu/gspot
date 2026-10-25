import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { extractBaseName, extractParentFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';

/**
Reports each file whose name without its extension matches the name of a sibling folder.

@param _session the repository and its tools.
@param planned the scope files.
@returns the findings.
*/
export function checkStructureFileFolderClashes(_session: Session, planned: PlannedCheck): Finding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    return files.flatMap((file) => {
        const stem = extractBaseName(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
        if (!siblings.some((sibling) => sibling.kind === 'folder' && sibling.name === stem)) return [];
        return [
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'file-folder-clash',
                `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            ),
        ];
    });
}
