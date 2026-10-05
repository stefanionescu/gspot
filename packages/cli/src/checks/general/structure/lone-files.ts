import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { directoryOf, directoryTree } from '#cli/platform/paths.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { isAllowedFolder, structureSources } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param input the check context
 * @returns the findings
 */
export const loneFiles: Engine = (input) => {
    const files = structureSources(input);
    const extensions = sourceConfigurations(input.selection.selected).flatMap((manifest) => manifest.files.extensions);
    const allowed = input.view.settings['structure.lone_files_allowed'] as PathAllowance[];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const tree = directoryTree(input.files);
    const checked = new Set(files.map((file) => directoryOf(file.path)));
    return [...checked].flatMap((directory) => {
        if (directory === '' || isAllowedFolder(directory, isAllowed)) return [];
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
