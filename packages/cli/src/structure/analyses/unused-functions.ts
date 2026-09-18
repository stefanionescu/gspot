import { ENTRY_FUNCTIONS, MARKERS } from '#config/shell.ts';
// A shell function no script calls. Searched: shellcheck (SC2329 sees one file), knip (no shell); neither reads the set.
import type { Analysis, ShellFile } from '#types/structure.ts';

/**
 * The names a marker allows in a file.
 * @param file the shell file
 * @param marker the per-function marker
 * @returns the names
 */
export function markedNames(file: ShellFile, marker: string): Set<string> {
    const names = new Set<string>();
    const pattern = new RegExp(String.raw`${marker}\s+([A-Za-z_][A-Za-z0-9_]*)`, 'u');
    for (const line of file.lines) {
        const match = pattern.exec(line);
        if (match?.[1] !== undefined) names.add(match[1]);
    }
    return names;
}

/**
 * One finding per function that no script references, outside the entry functions and the markers.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const unusedFunctions: Analysis = async (context, shell) => {
    const index = await shell();
    const referenced = new Set(index.files.flatMap((file) => file.references.keys().toArray()));
    return index.files.flatMap((file) => {
        if (file.text.includes(MARKERS.unusedFunctions)) return [];
        const allowed = markedNames(file, MARKERS.unusedFunction);
        return file.functions
            .filter(
                (entry) =>
                    !ENTRY_FUNCTIONS.includes(entry.name) && !allowed.has(entry.name) && !referenced.has(entry.name),
            )
            .map((entry) =>
                context.report(file.path, entry.start, 'never-called', `${entry.name} is called from no script.`),
            );
    });
};
