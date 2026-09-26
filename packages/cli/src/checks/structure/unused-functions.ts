import { ENTRY_FUNCTIONS } from '#cli/constants/checks/structure.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';

/**
 * One finding per function that no script references, outside the entry functions.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const unusedFunctions: Analysis = async (context, scripts) => {
    const index = await scripts();
    const referenced = new Set(index.files.flatMap((file) => file.references.keys().toArray()));
    return index.files.flatMap((file) => {
        return file.functions
            .filter((entry) => !ENTRY_FUNCTIONS.includes(entry.name) && !referenced.has(entry.name))
            .map((entry) =>
                context.report(file.path, entry.start, 'never-called', `${entry.name} is called from no script.`),
            );
    });
};
