// A shell function no script calls. Searched: shellcheck (SC2329 sees one file), knip (no shell); neither reads the set.
import type { Analysis } from '#cli/structure/engine.ts';
import { ENTRY_FUNCTIONS } from '#cli/structure/patterns.ts';

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
