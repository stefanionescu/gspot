import { buildFinding } from '#cli/runs/finding.ts';
import { listCodeLines } from '#cli/parsers/bash.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { COUNT_LIMITS } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Checks each shell function against the size limits: code lines and parser counts.
 * @param input the scope scripts and limits.
 * @returns one finding per exceeded limit.
 */
export async function checkBashFunctionSize(input: CheckInput): Promise<Finding[]> {
    const scripts = await readScripts(input);
    const limit = input.selection.view.limit('function_lines', 'bash');
    const lines = scripts.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const count = listCodeLines(entry.body).length;
            if (count <= limit) return [];
            return [
                buildFinding(
                    input,
                    { file: file.path, line: entry.start },
                    'function-lines',
                    `${entry.name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                ),
            ];
        }),
    );
    const counted = COUNT_LIMITS.flatMap((rule) => {
        const limit = input.selection.view.limit(rule.limit, 'bash');
        return scripts.flatMap((file) =>
            file.functions.flatMap((entry) => {
                const count = entry[rule.property];
                return count <= limit
                    ? []
                    : [
                          buildFinding(
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
