import { buildFinding } from '#cli/runs/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Reports each function that no script calls, except main.
 * @param input the scope scripts to read.
 * @returns the findings.
 */
export async function checkBashUnusedFunctions(input: CheckInput): Promise<Finding[]> {
    const scripts = await readScripts(input);
    const referenced = new Set(scripts.flatMap((file) => file.references.keys().toArray()));
    return scripts.flatMap((file) => {
        return file.functions
            .filter((entry) => entry.name !== MAIN_FUNCTION && !referenced.has(entry.name))
            .map((entry) =>
                buildFinding(
                    input,
                    { file: file.path, line: entry.start },
                    'never-called',
                    `No script in this scope calls ${entry.name}. Delete it, or call it.`,
                ),
            );
    });
}
