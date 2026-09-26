import { pathMatcher } from '#cli/repository/paths.ts';
import { IGNORED_FOLDERS } from '#cli/constants/checks/structure.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import { directoryOf, directoryTree } from '#cli/checks/structure/directories.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';

function isSkipped(directory: string, isAllowed: (path: string) => boolean): boolean {
    if (directory === '' || directory.split('/').some((segment) => IGNORED_FOLDERS.includes(segment))) return true;
    return isAllowed(directory) || isAllowed(`${directory}/`);
}

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param context the check context
 * @returns the findings
 */
export const singleFileFolder: Analysis = (context) => {
    const { input } = context;
    const selection = input.selection;
    const extensions = sourceConfigurations(selection.selected).flatMap((manifest) => manifest.claims.extensions);
    // The merged setting: what the repository allows and what a selected framework allows for its own layout.
    const allowed = (input.selection.view.settings['structure.single_file_folder_allowed'] ?? []) as {
        paths: string[];
    }[];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const tree = directoryTree(input.files);
    const checked = new Set(context.files.map((file) => directoryOf(file.path)));
    return [...checked].flatMap((directory) => {
        if (isSkipped(directory, isAllowed)) return [];
        const entries = tree.get(directory) ?? [];
        if (entries.some((entry) => entry.kind === 'dir')) return [];
        const code = entries.filter(
            (entry) => !entry.name.endsWith('.d.ts') && extensions.some((extension) => entry.name.endsWith(extension)),
        );
        const [only] = code;
        if (only === undefined || code.length !== 1) return [];
        return [
            context.report(
                `${directory}/${only.name}`,
                1,
                'lone-file',
                `The folder ${directory}/ holds only ${only.name}.`,
            ),
        ];
    });
};
