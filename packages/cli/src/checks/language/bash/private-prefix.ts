import { findingAt } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { MAIN_FUNCTION, PRIVATE_PREFIX } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per function whose underscore disagrees with its callers: file-local without one, or private with outside callers.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashPrivatePrefix(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    return index.flatMap((file) =>
        file.functions.flatMap((entry) => {
            if (entry.name === MAIN_FUNCTION || index.every((candidate) => !candidate.references.has(entry.name)))
                return [];
            const callers = index
                .filter(
                    (candidate) =>
                        candidate.path !== file.path && (candidate.references.get(entry.name)?.length ?? 0) > 0,
                )
                .map((candidate) => candidate.path)
                .toSorted((a, b) => a.localeCompare(b));
            const isPrivate = entry.name.startsWith(PRIVATE_PREFIX);
            if (isPrivate && callers.length > 0)
                return [
                    findingAt(
                        input,
                        { file: file.path, line: entry.start },
                        'called-outside',
                        `${entry.name} is private but ${callers.join(', ')} calls it.`,
                    ),
                ];
            if (!isPrivate && callers.length === 0)
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
}
