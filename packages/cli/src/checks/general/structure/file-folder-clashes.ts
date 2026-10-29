import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { extractBaseName, extractParentFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';
import { FILE_FOLDER_CLASH_RULE } from '#cli/config/checks/general/structure/file-folder-clashes.ts';

/**
Reports each file whose name without its extension matches the name of a sibling folder.

@param _session the repository and its tools.
@param planned the scope files.
*/
export function checkStructureFileFolderClashes(_session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    return files.flatMap((file) => {
        const stem = extractBaseName(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
        if (!siblings.some((sibling) => sibling.kind === 'folder' && sibling.name === stem)) return [];
        return [
            {
                file: file.path,
                line: 1,
                rule: FILE_FOLDER_CLASH_RULE,
                message: `${file.path} sits beside a folder named ${stem}/, so an import of ./${stem} names both.`,
            },
        ];
    });
}
