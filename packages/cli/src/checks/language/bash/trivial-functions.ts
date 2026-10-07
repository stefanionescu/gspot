import { findingAt } from '#cli/execution/finding.ts';
import { trivialText } from '#cli/parsers/statements.ts';
import type { Engine } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

/**
 * Report shell functions and files at or below the executable statement threshold.
 * @param input the check context
 * @returns the findings
 */
export const trivialFunctions: Engine = async (input) => {
    const threshold = input.view.limit('min_function_statements', 'bash');
    if (threshold === undefined) return [];
    const index = await getScriptIndex(input);
    const findings = index.files.flatMap((file) =>
        file.functions.flatMap((entry) =>
            entry.statements <= threshold
                ? [
                      findingAt(
                          input,
                          { file: file.path, line: entry.start },
                          'trivial-function',
                          trivialText(entry.name, entry.statements, threshold),
                      ),
                  ]
                : [],
        ),
    );
    for (const file of index.files) {
        if (file.isTrivialFile)
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'trivial-file',
                    'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                ),
            );
    }
    return findings;
};
