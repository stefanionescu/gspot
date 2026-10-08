import { readdirSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { directoryOf } from '#cli/platform/paths.ts';
import { sourcePath } from '#cli/platform/root/reads.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { structureSources, isDependencyFolder } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param input the check context
 * @returns the findings
 */
export const loneFiles: BuiltInCheck = (input) => {
    const files = structureSources(input);
    const extensions = sourceConfigurations(input.selection.selected).flatMap((manifest) => manifest.files.extensions);
    const checked = new Set(files.map((file) => directoryOf(file.path)));
    return [...checked].flatMap((directory) => {
        if (directory === '' || isDependencyFolder(directory)) return [];
        const entries = readdirSync(sourcePath(input.reads.root, directory), { withFileTypes: true });
        if (entries.some((entry) => entry.isDirectory())) return [];
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
