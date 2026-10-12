import { findingAt } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per function that no script references, outside the entry functions.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashUnusedFunctions(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    const referenced = new Set(index.flatMap((file) => file.references.keys().toArray()));
    return index.flatMap((file) => {
        return file.functions
            .filter((entry) => entry.name !== MAIN_FUNCTION && !referenced.has(entry.name))
            .map((entry) =>
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    'never-called',
                    `${entry.name} is called from no script.`,
                ),
            );
    });
}
