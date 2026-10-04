import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { directoryOf, directoryTree } from '#cli/platform/paths.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { IGNORED_FOLDERS } from '#cli/config/checks/general/structure.ts';
import { structureSources } from '#cli/checks/general/structure/source-files.ts';

function isSkipped(directory: string, isAllowed: (path: string) => boolean): boolean {
    if (directory === '' || directory.split('/').some((segment) => IGNORED_FOLDERS.includes(segment))) return true;
    return isAllowed(directory) || isAllowed(`${directory}/`);
}

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param input the check context
 * @returns the findings
 */
export const loneFiles: Engine = (input) => {
    const files = structureSources(input);
    const selection = input.selection;
    const extensions = sourceConfigurations(selection.selected).flatMap((manifest) => manifest.files.extensions);
    // The merged setting: what the repository allows and what a selected framework allows for its own layout.
    const allowed = (input.selection.view.settings['structure.lone_files_allowed'] ?? []) as PathAllowance[];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const tree = directoryTree(input.files);
    const checked = new Set(files.map((file) => directoryOf(file.path)));
    return [...checked].flatMap((directory) => {
        if (isSkipped(directory, isAllowed)) return [];
        const entries = tree.get(directory) ?? [];
        if (entries.some((entry) => entry.kind === 'dir')) return [];
        const siblings = entries.filter(
            (entry) => !DECLARATION_EXTENSIONS.some((extension) => entry.name.endsWith(extension)),
        );
        const [only] = siblings;
        if (only === undefined || siblings.length !== 1) return [];
        if (!extensions.some((extension) => only.name.endsWith(extension))) return [];
        return [
            findingAt(
                input,
                { file: `${directory}/${only.name}`, line: 1 },
                'lone-file',
                `The folder ${directory}/ holds only ${only.name}.`,
            ),
        ];
    });
};
