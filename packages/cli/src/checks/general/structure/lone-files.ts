import type { Session } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { extractParentFolder, isInInstalledFolder } from '#cli/system/paths.ts';
import { LONE_FILE_RULE } from '#cli/config/checks/general/structure/lone-files.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/general/structure/folder-tree.ts';

/**
Reports each leaf folder that holds only one code file.

@param _session the repository and its tools.
@param planned the scope files.
*/
export function checkStructureLoneFiles(_session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    const extensions = filterSourceConfigurations(planned.scope.configurations).flatMap(
        (configuration) => configuration.files.extensions,
    );
    const isRouteFile = buildPathMatcher(
        planned.scope.configurations.flatMap((configuration) => configuration.route_files),
    );
    const checked = new Set(files.map((file) => extractParentFolder(file.path)));
    return [...checked]
        .filter((folder) => folder !== '' && !isInInstalledFolder(folder))
        .flatMap((folder) => {
            const children = tree.get(folder) ?? [];
            if (children.some((child) => child.kind === 'folder')) return [];
            const siblings = children.filter(
                (child) => !DECLARATION_EXTENSIONS.some((extension) => child.name.endsWith(extension)),
            );
            const [only] = siblings;
            if (
                only === undefined ||
                siblings.length !== 1 ||
                !extensions.some((extension) => only.name.endsWith(extension)) ||
                isRouteFile(only.name)
            )
                return [];
            return [
                {
                    file: `${folder}/${only.name}`,
                    line: 1,
                    rule: LONE_FILE_RULE,
                    message: `The folder ${folder}/ holds only ${only.name}.`,
                },
            ];
        });
}
