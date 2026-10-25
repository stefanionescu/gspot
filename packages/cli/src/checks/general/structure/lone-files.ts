import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { extractParentFolder, isInInstalledFolder } from '#cli/system/paths.ts';
import { listCodeFiles, buildFolderTree, listSourceExtensions } from '#cli/checks/general/structure/folder-tree.ts';

/**
Reports each leaf folder that holds only one code file.

@param _session the repository and its tools.
@param planned the scope files.
@returns the findings.
*/
export function checkStructureLoneFiles(_session: Session, planned: PlannedCheck): Finding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    const extensions = listSourceExtensions(planned);
    const isRouteFile = buildPathMatcher(
        planned.scope.configurations.flatMap((configuration) => configuration.route_files),
    );
    const checked = new Set(files.map((file) => extractParentFolder(file.path)));
    return [...checked]
        .filter((folder) => folder !== '' && !isInInstalledFolder(folder))
        .flatMap((folder) => {
            const children = tree.get(folder) ?? [];
            if (children.some((child) => child.kind === 'folder')) return [];
            const siblings = children.filter((child) =>
                DECLARATION_EXTENSIONS.every((extension) => !child.name.endsWith(extension)),
            );
            const [only] = siblings;
            if (
                only === undefined ||
                siblings.length !== 1 ||
                extensions.every((extension) => !only.name.endsWith(extension)) ||
                isRouteFile(only.name)
            )
                return [];
            return [
                buildFinding(
                    planned,
                    { file: `${folder}/${only.name}`, line: 1 },
                    'lone-file',
                    `The folder ${folder}/ holds only ${only.name}.`,
                ),
            ];
        });
}
