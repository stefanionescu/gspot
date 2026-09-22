import { docstringOf } from '#cli/structure/python/modules.ts';
import type { PythonFunction, PythonModule, StructureProblem } from '#cli/structure/python/types.ts';

import { executableStatements } from '#cli/structure/statements.ts';
const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);
function problem(fn: PythonFunction, rule: string, text: string): StructureProblem {
    return { file: fn.path, line: fn.node.startPosition.row + 1, rule, text };
}

/** Report every implemented function at or below the configured statement threshold. */
export function trivialFunctions(functions: PythonFunction[], threshold: number): StructureProblem[] {
    return functions.flatMap((fn) => {
        const count = fn.node.type === 'lambda' ? 1 : executableStatements(fn.body, 'python');
        return count <= threshold
            ? [
                  problem(
                      fn,
                      'trivial-function',
                      `${fn.name} has ${count} executable statements, at most ${threshold}. Inline it or suppress its required API with a reason.`,
                  ),
              ]
            : [];
    });
}

function codeLines(lines: string[], from: number, to: number): number {
    return lines.slice(from, to).filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
}

/**
 * Docstrings that say nothing: a placeholder word, or the name of the function again.
 * @param functions every function of the run
 * @returns the problems
 */
export function placeholderDocstrings(functions: PythonFunction[]): StructureProblem[] {
    return functions.flatMap((fn) => {
        const text = docstringOf(fn.node);
        if (text === undefined) return [];
        const plain = text
            .toLowerCase()
            .replaceAll(/[^a-z\d]+/gu, ' ')
            .trim();
        const isName = plain === fn.name.toLowerCase().replaceAll('_', ' ').trim();
        if (plain !== '' && !isName && !PLACEHOLDERS.has(plain)) return [];
        return [
            problem(
                fn,
                'placeholder-docstring',
                `The docstring of ${fn.name} says nothing the name does not. Say what the function does, or for whom.`,
            ),
        ];
    });
}

/**
 * Functions with more code lines than the ceiling.
 * @param modules every module of the run
 * @param functions every function of the run
 * @param ceiling the most code lines a function may hold
 * @returns the problems
 */
export function longFunctions(
    modules: PythonModule[],
    functions: PythonFunction[],
    ceiling: number,
): StructureProblem[] {
    const lines = new Map(modules.map((module) => [module.path, module.lines]));
    return functions.flatMap((fn) => {
        const count = codeLines(lines.get(fn.path) ?? [], fn.node.startPosition.row, fn.node.endPosition.row + 1);
        return count <= ceiling
            ? []
            : [
                  problem(
                      fn,
                      'function-lines',
                      `${fn.name} holds ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                  ),
              ];
    });
}

/**
 * Modules with more code lines than the ceiling.
 * @param modules every module of the run
 * @param ceiling the most code lines a file may hold
 * @returns the problems
 */
export function longModules(modules: PythonModule[], ceiling: number): StructureProblem[] {
    return modules.flatMap((module) => {
        const count = codeLines(module.lines, 0, module.lines.length);
        return count <= ceiling
            ? []
            : [
                  {
                      file: module.path,
                      line: 1,
                      rule: 'file-lines',
                      text: `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`,
                  },
              ];
    });
}
