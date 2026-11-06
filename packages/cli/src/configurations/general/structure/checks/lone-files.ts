import { LONE_FILE_RULE } from '#cli/config/configurations/structure.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { buildFolderTree, listCodeFiles } from '#cli/configurations/general/structure/checks/folder-tree.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractParentFolder, isInInstalledFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

function checkLoneFiles(_session: Session, planned: PlannedCheck): CheckFinding[] {
    const files = listCodeFiles(planned);
    const tree = buildFolderTree(planned.files);
    const extensions = listSourceConfigurations(planned.scope.configurations).flatMap(
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
                {
                    file: `${folder}/${only.name}`,
                    line: 1,
                    rule: LONE_FILE_RULE,
                    message: `The folder ${folder}/ holds only ${only.name}.`,
                },
            ];
        });
}

export const STRUCTURE_LONE_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/lone-files': { check: checkLoneFiles },
};
