import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/contracts.ts';
import { ENTRY_FUNCTIONS } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per function whose underscore disagrees with its callers: file-local without one, or private with outside callers.
 * @param input the check context
 * @returns the findings
 */
export const privatePrefix: BuiltInCheck = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (
                ENTRY_FUNCTIONS.includes(entry.name) ||
                index.files.every((candidate) => !candidate.references.has(entry.name))
            )
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
