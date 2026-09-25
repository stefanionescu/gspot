import type { Analysis } from '#cli/checks/structure/engine.ts';
import { ENTRY_FUNCTIONS } from '#cli/checks/structure/patterns.ts';
import { outsideCallers } from '#cli/checks/structure/cross-file-index.ts';

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

/**
 * One finding per private function below a public one, and one when main is not the last function.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const privateBeforePublic: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) => {
        let isPublicSeen = false;
        const findings = file.functions.flatMap((entry) => {
            const isPrivate = entry.name.startsWith('_');
            const found =
                isPrivate && isPublicSeen
                    ? [
                          context.report(
                              file.path,
                              entry.start,
                              'private-below-public',
                              `${entry.name} is private and sits below a public function.`,
                          ),
                      ]
                    : [];
            isPublicSeen ||= !isPrivate;
            return found;
        });
        const main = file.functions.find((entry) => entry.name === 'main');
        const last = file.functions.at(-1);
        if (main !== undefined && last !== undefined && last.name !== 'main')
            findings.push(context.report(file.path, main.start, 'main-not-last', 'main is not the last function.'));
        return findings;
    });
};
