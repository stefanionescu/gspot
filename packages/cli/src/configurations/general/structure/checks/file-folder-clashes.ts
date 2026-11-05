import { FILE_FOLDER_CLASH_RULE, GSPOT_FIXED_NAMES } from '#cli/config/configurations/structure.ts';
import { buildFolderTree, listCodeFiles } from '#cli/configurations/general/structure/checks/folder-tree.ts';
import { extractBaseName, extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Reports each file whose name without its extension matches the name of a sibling folder. gspot fixes the names of
gspot.toml and gspot.baseline.json, so they clash with no folder.

@param _session the repository and its tools.
@param planned the scope files.
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
