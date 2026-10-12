import { readdirSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { directoryOf } from '#cli/system/paths.ts';
import { sourcePath } from '#cli/system/safe-folder/reads.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { structureSources, isDependencyFolder } from '#cli/checks/general/structure/source-files.ts';

/**
 * One finding per leaf folder that holds exactly one code file and nothing else.
 * @param input the check context.
 * @returns the findings.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- reason: All built-in checks return promises; this check computes findings from captured data.
export async function loneFiles(input: CheckInput): Promise<Finding[]> {
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
}
