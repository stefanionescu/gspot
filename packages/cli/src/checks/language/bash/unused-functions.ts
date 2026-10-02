import { findingAt } from '#cli/execution/finding.ts';
import { ENTRY_FUNCTIONS } from '#cli/config/checks/language/bash.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';

/**
 * One finding per function that no script references, outside the entry functions.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const unusedFunctions: Analysis = async (context, scripts) => {
    const entries = new Set([...ENTRY_FUNCTIONS, ...context.bashList('entry_functions')]);
    const index = await scripts();
    const referenced = new Set(index.files.flatMap((file) => file.references.keys().toArray()));
    return index.files.flatMap((file) => {
        return file.functions
            .filter((entry) => !entries.has(entry.name) && !referenced.has(entry.name))
            .map((entry) =>
                findingAt(
                    context.input,
                    { file: file.path, line: entry.start },
                    'never-called',
                    `${entry.name} is called from no script.`,
                ),
            );
    });
};
