import { compareText } from '#cli/system/text.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/files/tracked.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';

/**
 * Reports each folder inside the scope that holds only one folder, above the code of the scope.
 *
 * @param session the repository and its tools.
 * @param planned the scope files.
 * @returns the findings.
 */
export function checkPassThroughFolders(session: Session, planned: PlannedCheck): Finding[] {
    const extensions = filterSourceConfigurations(planned.scope.configurations).flatMap(
        (configuration) => configuration.files.extensions,
    );
    const code = listCodeFiles(planned).filter((file) => extensions.some((extension) => file.path.endsWith(extension)));
    const tree = buildFolderTree(session.repository.files);
    const scope = planned.scope.folder.path;
    const folders = new Set(code.flatMap((file) => listEnclosingFolders(extractParentFolder(file.path))));
    return [...folders]
        .filter((folder) => folder !== scope && (scope === '' || folder.startsWith(`${scope}/`)))
        .filter((folder) => !folder.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment)))
        .toSorted((left, right) => compareText(left, right))
        .flatMap((folder) => {
            const children = tree.get(folder) ?? [];
            const [only] = children;
            if (children.length !== 1 || only?.kind !== 'folder') return [];
            return [
                buildFinding(
                    planned,
                    { file: folder },
                    'pass-through-folder',
                    `The folder ${folder}/ holds only the folder ${only.name}/. Remove one of the two levels.`,
                ),
            ];
        });
}
