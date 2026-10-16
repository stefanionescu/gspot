import { findingAt } from '#cli/checks/finding.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { directoryTree, structureSources, isDependencyFolder } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param input the check context.
 * @returns the findings.
 */
export function loneFiles(input: CheckInput): Finding[] {
    const files = structureSources(input);
    const tree = directoryTree(input.files);
    const extensions = sourceConfigurations(input.selection.selected).flatMap((manifest) => manifest.files.extensions);
    const checked = new Set(files.map((file) => extractParentFolder(file.path)));
    return [...checked].flatMap((directory) => {
        if (directory === '' || isDependencyFolder(directory)) return [];
        const entries = tree.get(directory) ?? [];
        if (entries.some((entry) => entry.kind === 'dir')) return [];
        const siblings = entries.filter(
            (entry) => ![...DECLARATION_EXTENSIONS].some((extension) => entry.name.endsWith(extension)),
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
}
