import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { ENTRY_FUNCTIONS } from '#cli/config/checks/language/bash.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

/**
 * One finding per function that no script references, outside the entry functions.
 * @param input the check context
 * @returns the findings
 */
export const unusedFunctions: BuiltInCheck = async (input) => {
    const index = await getScriptIndex(input);
    const referenced = new Set(index.files.flatMap((file) => file.references.keys().toArray()));
    return index.files.flatMap((file) => {
        return file.functions
            .filter((entry) => !ENTRY_FUNCTIONS.includes(entry.name) && !referenced.has(entry.name))
            .map((entry) =>
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    'never-called',
                    `${entry.name} is called from no script.`,
                ),
            );
    });
};
