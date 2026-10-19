import picomatch from 'picomatch';
import { buildFinding } from '#cli/runs/finding.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { isInDependencyFolder } from '#cli/repository/classify.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { listCodeFiles, buildFolderTree } from '#cli/checks/structure/folder-tree.ts';

// A code file of the scope that no framework routes by its folder.
function isLoneCode(name: string, extensions: string[], isRouteFile: (name: string) => boolean): boolean {
    return extensions.some((extension) => name.endsWith(extension)) && !isRouteFile(name);
}

/**
 * Reports each leaf folder that holds only one code file.
 * @param input the scope files.
 * @returns the findings.
 */
export function checkLoneFiles(input: CheckInput): Finding[] {
    const files = listCodeFiles(input);
    const tree = buildFolderTree(input.files);
    const extensions = filterSourceConfigurations(input.selection.selected).flatMap(
        (manifest) => manifest.files.extensions,
    );
    const isRouteFile = picomatch(input.selection.selected.flatMap((manifest) => manifest.route_files));
    const checked = new Set(files.map((file) => extractParentFolder(file.path)));
    return [...checked].flatMap((folder) => {
        if (folder === '' || isInDependencyFolder(folder)) return [];
        const entries = tree.get(folder) ?? [];
        if (entries.some((entry) => entry.kind === 'folder')) return [];
        const siblings = entries.filter(
            (entry) => !DECLARATION_EXTENSIONS.some((extension) => entry.name.endsWith(extension)),
        );
        const [only] = siblings;
        if (only === undefined || siblings.length !== 1 || !isLoneCode(only.name, extensions, isRouteFile)) return [];
        return [
            buildFinding(
                input,
                { file: `${folder}/${only.name}`, line: 1 },
                'lone-file',
                `The folder ${folder}/ holds only ${only.name}.`,
            ),
        ];
    });
}
