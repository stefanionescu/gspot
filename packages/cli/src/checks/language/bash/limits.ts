// The size ceilings of a shell script: file and function lines, and the ast-grep counts.
import { findingAt } from '#cli/execution/finding.ts';
import type { Finding } from '#cli/types/execution/execution.ts';
import { functionAt } from '#cli/checks/language/bash/scripts.ts';
import { codeLines } from '#cli/checks/language/bash/code-lines.ts';
import { astGrepMatches } from '#cli/checks/language/bash/ast-grep.ts';
import type { ScriptIndex, AstGrepMatch } from '#cli/types/checks/language/bash.ts';
import { RULES, OUTER_LEVELS, COUNT_ANALYSES } from '#cli/config/checks/language/bash.ts';
import type { StructureInput, StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';

function scoreFor(matches: AstGrepMatch[], isDepth: boolean): number {
    if (!isDepth) return matches.length;
    let deepest = matches.length === 0 ? 0 : 1;
    for (const match of matches) {
        const containing = matches.filter(
            (other) =>
                other !== match &&
                other.range.start.line <= match.range.start.line &&
                other.range.end.line >= match.range.end.line,
        );
        deepest = Math.max(deepest, containing.length + OUTER_LEVELS);
    }
    return deepest;
}

/**
 * Runs one count rule over the scope's scripts and reports every function over its limit.
 * @param analysis the check's analysis name
 * @param context the check context
 * @param index the shell index
 * @returns the findings; a missing ast-grep raises MissingToolError
 */
async function countFindings(analysis: string, context: StructureInput, index: ScriptIndex): Promise<Finding[]> {
    const rule = RULES[analysis];
    const ceiling = rule === undefined ? undefined : context.limit(rule.limit, 'bash');
    if (rule === undefined || ceiling === undefined) return [];
    const matches = await astGrepMatches(
        context.input,
        `kits/language/bash/ast-grep/${rule.asset}`,
        index.files.map((file) => file.path),
    );
    return index.files.flatMap((file) => {
        const inFile = matches.filter((match) => match.file === file.path);
        return file.functions.flatMap((entry) => {
            const own = inFile.filter(
                (match) => functionAt(file.functions, match.range.start.line + 1)?.start === entry.start,
            );
            const score = scoreFor(own, rule.isDepth);
            if (score <= ceiling) return [];
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: entry.start },
                    rule.limit.replaceAll('_', '-'),
                    `${entry.name} has ${String(score)} ${rule.noun}, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        });
    });
}

/**
 * One finding per script whose code lines exceed limits.bash.file_lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
const fileLength: Analysis = async (context, scripts) => {
    const ceiling = context.limit('file_lines', 'bash');
    if (ceiling === undefined) return [];
    const index = await scripts();
    return index.files.flatMap((file) => {
        const count = codeLines(file.lines).length;
        if (count <= ceiling) return [];
        return [
            findingAt(
                context.input,
                { file: file.path, line: 1 },
                'file-lines',
                `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`,
            ),
        ];
    });
};

/**
 * One finding per function whose body code lines exceed limits.bash.function_lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
const functionLength: Analysis = async (context, scripts) => {
    const ceiling = context.limit('function_lines', 'bash');
    if (ceiling === undefined) return [];
    const index = await scripts();
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const count = codeLines(entry.body).length;
            if (count <= ceiling) return [];
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: entry.start },
                    'function-lines',
                    `${entry.name} has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        }),
    );
};

/**
 * Every size ceiling of a shell script in one pass: file and function lines, then the ast-grep counts.
 * @param context the structure input of the scope
 * @param scripts the shell script index, read once
 * @returns the findings over a ceiling
 */
export const bashLimits: Analysis = async (context, scripts) => {
    const index = await scripts();
    const counted = await Promise.all([...COUNT_ANALYSES].map((analysis) => countFindings(analysis, context, index)));
    return [...(await fileLength(context, scripts)), ...(await functionLength(context, scripts)), ...counted.flat()];
};
