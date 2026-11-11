import { PASS_THROUGH_FOLDER_RULE } from '#cli/config/configurations/structure.ts';
import { buildFolderTree, listCodeFiles } from '#cli/configurations/general/structure/checks/folder-tree.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { extractParentFolder, isInInstalledFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function checkPassThroughFolders(session: Session, planned: PlannedCheck): CheckFinding[] {
    const extensions = listSourceConfigurations(planned.scope.configurations).flatMap(
        (configuration) => configuration.files.extensions,
    );
    const code = listCodeFiles(planned).filter((file) => extensions.some((extension) => file.path.endsWith(extension)));
    const tree = buildFolderTree(session.repository.files);
    const scopePath = planned.scope.path;
    const folders = new Set(code.flatMap((file) => listEnclosingFolders(extractParentFolder(file.path))));
    return [...folders]
        .filter((folder) => folder !== scopePath && (scopePath === '' || folder.startsWith(`${scopePath}/`)))
        .filter((folder) => !isInInstalledFolder(folder))
        .toSorted((left, right) => compareText(left, right))
        .flatMap((folder) => {
            const children = tree.get(folder) ?? [];
            const [only] = children;
            if (children.length !== 1 || only?.kind !== 'folder') return [];
            return [
                {
                    file: folder,
                    rule: PASS_THROUGH_FOLDER_RULE,
                    message: `The folder ${folder}/ holds only the folder ${only.name}/. Remove one of the two levels.`,
                },
            ];
        });
}

export const PASS_THROUGH_FOLDERS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/pass-through-folders': { check: checkPassThroughFolders },
};
