import { findingAt } from '#cli/execution/finding.ts';
import { ENTRY_FUNCTIONS } from '#cli/config/checks/structure.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks.ts';

/**
 * One finding per function whose underscore disagrees with its callers: file-local without one, or private with outside callers.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const privatePrefix: Analysis = async (context, scripts) => {
    const entries = new Set([...ENTRY_FUNCTIONS, ...context.bashList('entry_functions')]);
    const index = await scripts();
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (entries.has(entry.name)) return [];
            const callers = index.files
                .filter(
                    (candidate) =>
                        candidate.path !== file.path && (candidate.references.get(entry.name)?.length ?? 0) > 0,
                )
                .map((candidate) => candidate.path)
                .toSorted((a, b) => a.localeCompare(b));
            const isPrivate = entry.name.startsWith('_');
            if (isPrivate && callers.length > 0)
                return [
                    findingAt(
                        context.input,
                        { file: file.path, line: entry.start },
                        'private-called-outside',
                        `${entry.name} is private but ${callers.join(', ')} calls it.`,
                    ),
                ];
            if (!isPrivate && callers.length === 0)
                return [
                    findingAt(
                        context.input,
                        { file: file.path, line: entry.start },
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
        const findings = [];
        let isPublicSeen = false;
        for (const entry of file.functions) {
            const isPrivate = entry.name.startsWith('_');
            if (isPrivate && isPublicSeen)
                findings.push(
                    findingAt(
                        context.input,
                        { file: file.path, line: entry.start },
                        'private-below-public',
                        `${entry.name} is private and sits below a public function.`,
                    ),
                );
            isPublicSeen ||= !isPrivate;
        }
        const main = file.functions.find((entry) => entry.name === 'main');
        const last = file.functions.at(-1);
        if (main !== undefined && last !== undefined && last.name !== 'main')
            findings.push(
                findingAt(
                    context.input,
                    { file: file.path, line: main.start },
                    'main-not-last',
                    'main is not the last function.',
                ),
            );
        return findings;
    });
};
