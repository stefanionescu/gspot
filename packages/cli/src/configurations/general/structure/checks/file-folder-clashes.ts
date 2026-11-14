import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import { extractBaseName, extractParentFolder } from '#cli/system/paths.ts';
import { GSPOT_FIXED_NAMES, FILE_FOLDER_CLASH_RULE } from '#cli/config/configurations/structure.ts';
import { listCodeFiles, buildFolderTree } from '#cli/configurations/general/structure/checks/folder-tree.ts';

/**
Reports each file whose name without its extension matches the name of a sibling folder. gspot fixes the name of
gspot.toml, so it clashes with no folder.
*/
function checkFileFolderClashes(_session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = listCodeFiles(planned).filter(({ path }) => !GSPOT_FIXED_NAMES.has(path));
    const tree = buildFolderTree(planned.files);
    return files.flatMap((file) => {
        const stem = extractBaseName(file.path);
        const siblings = tree.get(extractParentFolder(file.path)) ?? [];
        if (siblings.every((sibling) => !(sibling.kind === 'folder' && sibling.name === stem))) return [];
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

export const FILE_FOLDER_CLASHES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/file-folder-clashes': { check: checkFileFolderClashes },
};
