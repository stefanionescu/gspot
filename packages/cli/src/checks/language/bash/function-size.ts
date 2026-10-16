import { findingAt } from '#cli/checks/finding.ts';
import { listCodeLines } from '#cli/parsers/bash.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { COUNT_LIMITS } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * Every size limit of a shell function: code lines and parser counts.
 * @param input the structure input of the scope.
 * @returns the findings over a limit.
 */
export async function bashFunctionSize(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    const limit = input.scope.view.limit('function_lines', 'bash');
    const lines = index.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const count = listCodeLines(entry.body).length;
            if (count <= limit) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    'function-lines',
                    `${entry.name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                ),
            ];
        }),
    );
    const counted = COUNT_LIMITS.flatMap((rule) => {
        const limit = input.scope.view.limit(rule.limit, 'bash');
        return index.flatMap((file) =>
            file.functions.flatMap((entry) => {
                const count = entry[rule.limit];
                return count <= limit
                    ? []
                    : [
                          findingAt(
                              input,
                              { file: file.path, line: entry.start },
                              rule.limit,
                              `${entry.name} has ${String(count)} ${rule.noun}, over the limit of ${String(limit)}.`,
                          ),
                      ];
            }),
        );
    });
    return [...lines, ...counted];
}
