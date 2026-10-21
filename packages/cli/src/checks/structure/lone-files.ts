import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { isInDependencyFolder } from '#cli/repository/classify.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/structure/folder-tree.ts';

/**
 * Reports each leaf folder that holds only one code file.
 *
 * @param _session the repository and its tools.
 * @param planned the scope files.
 * @returns the findings.
 */
export function checkLoneFiles(_session: Session, planned: PlannedCheck): Finding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    const extensions = filterSourceConfigurations(planned.selection.selected).flatMap(
        (manifest) => manifest.files.extensions,
    );
    const isRouteFile = buildPathMatcher(planned.selection.selected.flatMap((manifest) => manifest.route_files));
    const checked = new Set(files.map((file) => extractParentFolder(file.path)));
    return [...checked]
        .filter((folder) => folder !== '' && !isInDependencyFolder(folder))
        .flatMap((folder) => {
            const entries = tree.get(folder) ?? [];
            if (entries.some((entry) => entry.kind === 'folder')) return [];
            const siblings = entries.filter(
                (entry) => !DECLARATION_EXTENSIONS.some((extension) => entry.name.endsWith(extension)),
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
                buildFinding(
                    planned,
                    { file: `${folder}/${only.name}`, line: 1 },
                    'lone-file',
                    `The folder ${folder}/ holds only ${only.name}.`,
                ),
            ];
        });
}
