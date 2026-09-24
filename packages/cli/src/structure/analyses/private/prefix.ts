// The underscore on shell functions no other file calls. Searched: shellcheck; it has no notion of a file set.
import type { Analysis } from '#cli/structure/engine.ts';
import { ENTRY_FUNCTIONS } from '#cli/structure/patterns.ts';
import { outsideCallers } from '#cli/structure/cross-file-index.ts';

/**
 * One finding per function whose underscore disagrees with its callers: file-local without one, or private with outside callers.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const privatePrefix: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (ENTRY_FUNCTIONS.includes(entry.name)) return [];
            const callers = outsideCallers(index, entry.name, file.path);
            const isPrivate = entry.name.startsWith('_');
            if (isPrivate && callers.length > 0)
                return [
                    context.report(
                        file.path,
                        entry.start,
                        'private-called-outside',
                        `${entry.name} is private but ${callers.join(', ')} calls it.`,
                    ),
                ];
            if (!isPrivate && callers.length === 0)
                return [
                    context.report(
                        file.path,
                        entry.start,
                        'file-local',
                        `${entry.name} is called from no other file; name it _${entry.name}.`,
                    ),
                ];
            return [];
        }),
    );
};
