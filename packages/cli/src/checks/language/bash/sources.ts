import { findingAt } from '#cli/execution/finding.ts';
import { functionAt } from '#cli/checks/language/bash/scripts.ts';
import type { ScriptFile } from '#cli/types/checks/language/bash.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';
import { SOURCE_STATEMENT, SHELLCHECK_DIRECTIVE } from '#cli/config/checks/language/bash.ts';

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
 * One finding per comment among a script's source statements that is not a ShellCheck directive.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptSourceComments: Analysis = async (context, scripts) => {
    const index = await scripts();
    return index.files.flatMap((file) =>
        sourceRuns(file).flatMap((run) => {
            const [first] = run;
            const last = run.at(-1);
            if (first === undefined || last === undefined) return [];
            return file.lines.slice(first, last).flatMap((line, offset) => {
                const text = line.trim();
                if (!text.startsWith('#') || SHELLCHECK_DIRECTIVE.test(text)) return [];
                return [
                    findingAt(
                        context.input,
                        { file: file.path, line: first + offset + 1 },
                        'source-comment',
                        'No comments among source statements. Say it where the sourced file is used, or above the block.',
                    ),
                ];
            });
        }),
    );
};

/**
 * One finding per run of source statements that is not ordered by length, shortest first.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptSourceOrder: Analysis = async (context, scripts) => {
    const index = await scripts();
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
                    context.input,
                    { file: file.path, line: misplaced.position + 1 },
                    'source-order',
                    `Source statements go shortest first: ${sorted.map((entry) => entry.text).join(', ')}.`,
                ),
            ];
        }),
    );
};
