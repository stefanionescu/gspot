// The size ceilings of a shell script: file and function lines, and the ast-grep counts.
import { codeLines } from '#cli/parsers/bash.ts';
import { relative, isAbsolute } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { assetPath } from '#cli/platform/assets.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { astGrepReportSchema } from '#cli/parsers/schema/ast-grep.ts';
import { COUNT_RULES, OUTER_LEVELS } from '#cli/config/checks/language/bash.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import type { Engine, Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import type { ScriptIndex, AstGrepMatch, BashCountRule } from '#cli/types/checks/language/bash.ts';

/**
 * Runs one ast-grep rule over the files.
 * @param input the engine input
 * @param asset the rule's asset path, such as `configurations/language/bash/ast-grep/branches.yml`
 * @param files the files, relative to the root
 * @returns every match, with zero-based lines and a root-relative path
 */
async function runAstGrep(input: EngineInput, asset: string, files: string[]): Promise<AstGrepMatch[]> {
    if (files.length === 0) return [];
    const root = input.root;
    const rule = assetPath(asset);
    const command = ['ast-grep', 'scan', '--json=compact', '-r', rule];
    const parsed: AstGrepMatch[] = [];
    for (const batch of fileBatches(files, command, process.platform)) {
        const result = await runEngineTool(input, [...command, ...batch], { cwd: root });
        if (result.code !== 0 && result.code !== 1) throw new Error(`The ast-grep run failed: ${result.stderr.trim()}`);
        const matches = astGrepReportSchema.parse(JSON.parse(result.stdout));
        parsed.push(...matches);
    }
    const selected = new Set(files);
    return parsed.map((match) => {
        const file = toPosix(isAbsolute(match.file) ? relative(root, match.file) : match.file);
        if (!selected.has(file)) throw new Error(`The ast-grep report names an unselected file: ${file}`);
        return { ...match, file };
    });
}

function nestingDepth(matches: AstGrepMatch[]): number {
    let deepest = 0;
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
 * @param rule the count query and its size limit
 * @param input the check context
 * @param index the shell index
 * @returns the findings; a missing ast-grep raises MissingToolError
 */
async function countFindings(rule: BashCountRule, input: EngineInput, index: ScriptIndex): Promise<Finding[]> {
    const ceiling = input.view.limit(rule.limit, 'bash');
    if (ceiling === undefined) return [];
    const matches = await runAstGrep(
        input,
        `configurations/language/bash/ast-grep/${rule.limit}.yml`,
        index.files.map((file) => file.path),
    );
    return index.files.flatMap((file) => {
        const inFile = matches.filter((match) => match.file === file.path);
        return file.functions.flatMap((entry) => {
            const own = inFile.filter(
                (match) => functionAt(file.functions, match.range.start.line + 1)?.start === entry.start,
            );
            const score = rule.isDepth ? nestingDepth(own) : own.length;
            if (score <= ceiling) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    rule.limit,
                    `${entry.name} has ${String(score)} ${rule.noun}, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        });
    });
}

/**
 * One finding per script whose code lines exceed limits.bash.file_lines.
 * @param input the check context
 * @param index the parsed shell files and functions
 * @returns the findings
 */
function fileLines(input: EngineInput, index: ScriptIndex): Finding[] {
    const ceiling = input.view.limit('file_lines', 'bash');
    if (ceiling === undefined) return [];
    return index.files.flatMap((file) => {
        const count = codeLines(file.code).length;
        if (count <= ceiling) return [];
        return [
            findingAt(
                input,
                { file: file.path, line: 1 },
                'file-lines',
                `This file has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
            ),
        ];
    });
}

/**
 * One finding per function whose body code lines exceed limits.bash.function_lines.
 * @param input the check context
 * @param index the parsed shell files and functions
 * @returns the findings
 */
function functionLines(input: EngineInput, index: ScriptIndex): Finding[] {
    const ceiling = input.view.limit('function_lines', 'bash');
    if (ceiling === undefined) return [];
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const count = codeLines(entry.body).length;
            if (count <= ceiling) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    'function-lines',
                    `${entry.name} has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        }),
    );
}

/**
 * Every size ceiling of a shell script: file and function lines, then the ast-grep counts.
 * @param input the structure input of the scope
 * @returns the findings over a ceiling
 */
export const bashLimits: Engine = async (input) => {
    const index = await getScriptIndex(input);
    const counted = await Promise.all(COUNT_RULES.map((rule) => countFindings(rule, input, index)));
    return [...fileLines(input, index), ...functionLines(input, index), ...counted.flat()];
};
