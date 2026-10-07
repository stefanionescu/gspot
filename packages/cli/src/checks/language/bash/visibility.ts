import { findingAt } from '#cli/checks/finding.ts';
import type { Engine } from '#cli/types/execution/check.ts';
import { entryFunctions, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

/**
 * One finding per function whose underscore disagrees with its callers: file-local without one, or private with outside callers.
 * @param input the check context
 * @returns the findings
 */
export const privatePrefix: Engine = async (input) => {
    const entries = entryFunctions(input);
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (entries.has(entry.name) || index.files.every((candidate) => !candidate.references.has(entry.name)))
                return [];
            const callers = index.files
                .filter(
                    (candidate) =>
                        candidate.path !== file.path && (candidate.references.get(entry.name)?.length ?? 0) > 0,
                )
                .map((candidate) => candidate.path)
                .toSorted((a, b) => a.localeCompare(b));
            const isToolProject = entry.name.startsWith('_');
            if (isToolProject && callers.length > 0)
                return [
                    findingAt(
                        input,
                        { file: file.path, line: entry.start },
                        'called-outside',
                        `${entry.name} is private but ${callers.join(', ')} calls it.`,
                    ),
                ];
            if (!isToolProject && callers.length === 0)
                return [
                    findingAt(
                        input,
                        { file: file.path, line: entry.start },
                        'unprefixed',
                        `${entry.name} is called from no other file; name it _${entry.name}.`,
                    ),
                ];
            return [];
        }),
    );
};

/**
 * One finding per private function below a public one, and one when main is not the last function.
 * @param input the check context
 * @returns the findings
 */
export const privateBeforePublic: Engine = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        const findings = [];
        let isPublicSeen = false;
        for (const entry of file.functions) {
            const isToolProject = entry.name.startsWith('_');
            if (isToolProject && isPublicSeen)
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: entry.start },
                        'private-before-public',
                        `${entry.name} is private and sits below a public function.`,
                    ),
                );
            isPublicSeen ||= !isToolProject;
        }
        const main = file.functions.find((entry) => entry.name === 'main');
        const last = file.functions.at(-1);
        if (main !== undefined && last !== undefined && last.name !== 'main')
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: main.start },
                    'main-not-last',
                    'main is not the last function.',
                ),
            );
        return findings;
    });
};
