import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { isInInstalledFolder, extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree, listSourceExtensions } from '#cli/checks/general/structure/folder-tree.ts';

/**
Reports each folder inside the scope that holds only one folder, above the code of the scope.

@param session the repository and its tools.
@param planned the scope files.
@returns the findings.
*/
export function checkStructurePassThroughFolders(session: Session, planned: PlannedCheck): Finding[] {
    const extensions = listSourceExtensions(planned);
    const code = listCodeFiles(planned).filter((file) => extensions.some((extension) => file.path.endsWith(extension)));
    const tree = buildFolderTree(session.repository.files);
    const scope = planned.scope.folder.path;
    const folders = new Set(code.flatMap((file) => listEnclosingFolders(extractParentFolder(file.path))));
    return [...folders]
        .filter((folder) => folder !== scope && (scope === '' || folder.startsWith(`${scope}/`)))
        .filter((folder) => !isInInstalledFolder(folder))
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
