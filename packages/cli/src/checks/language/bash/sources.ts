import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import type { ScriptFile } from '#cli/types/checks/language/bash.ts';
import { SOURCE_STATEMENT } from '#cli/config/checks/language/bash.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/contracts.ts';

// The runs of top-level source statements, each as the zero-based lines it spans. Blank lines and comments join a run.
function sourceRuns(file: ScriptFile): number[][] {
    const runs: number[][] = [[]];
    for (const [position, line] of file.lines.entries()) {
        const text = line.trim();
        if (SOURCE_STATEMENT.test(text) && functionAt(file.functions, position + 1) === undefined)
            runs.at(-1)?.push(position);
        else if (text !== '' && !text.startsWith('#')) runs.push([]);
    }
    return runs.filter((run) => run.length > 0);
}

/**
 * One finding per run of source statements that is not ordered by length, shortest first.
 * @param input the check context
 * @returns the findings
 */
export const sourceOrder: BuiltInCheck = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) =>
        sourceRuns(file).flatMap((run) => {
            const statements = run.map((position) => ({ position, text: file.lines[position]?.trim() ?? '' }));
            const sorted = statements.toSorted(
                (left, right) => left.text.length - right.text.length || left.text.localeCompare(right.text),
            );
            const misplaced = statements.find((entry, order) => entry.position !== sorted[order]?.position);
            if (misplaced === undefined) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: misplaced.position + 1 },
                    'source-order',
                    `Source statements go shortest first: ${sorted.map((entry) => entry.text).join(', ')}.`,
                ),
            ];
        }),
    );
};
