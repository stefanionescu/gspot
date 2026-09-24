// Private shell functions above the public ones, main last. Searched: shfmt, shellcheck; neither orders declarations.
import type { Analysis } from '#cli/structure/engine.ts';

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
