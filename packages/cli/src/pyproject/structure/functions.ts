// What a function body says about the function: it forwards, it is used once and tiny, its docstring says nothing, or it is long.
import type { Node } from 'web-tree-sitter';
import { docstringOf } from '#cli/pyproject/structure/modules.ts';
import type { PythonFunction, PythonModule, StructureProblem } from '#types/pyproject.ts';

const TRIVIAL_STATEMENTS = 2;
// The name followed by a bracket appears once where the function is defined and once where its one caller calls it.
const ONE_CALLER_COUNT = 2;
const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);
const RUNNER_NAMES = /^(?:main|test_\w*|__\w+__)$/u;

function problem(fn: PythonFunction, rule: string, text: string): StructureProblem {
    return { file: fn.path, line: fn.node.startPosition.row + 1, rule, text };
}

function parameterNames(fn: PythonFunction): string[] {
    const parameters = fn.node.childForFieldName('parameters')?.namedChildren ?? [];
    return parameters
        .map((parameter) => (parameter.childForFieldName('name') ?? parameter.namedChildren[0] ?? parameter).text)
        .filter((name) => name !== 'self' && name !== 'cls');
}

// The call a body forwards to when it is one return of one call, or undefined.
function forwardedCall(fn: PythonFunction): Node | undefined {
    const [only, ...rest] = fn.body;
    if (only === undefined || rest.length > 0 || only.type !== 'return_statement') return undefined;
    const value = only.namedChildren[0];
    return value?.type === 'call' ? value : undefined;
}

function callCount(modules: PythonModule[], name: string): number {
    const pattern = new RegExp(String.raw`(?<![\w.])${name}\(`, 'gu');
    return modules.reduce((sum, module) => sum + module.lines.join('\n').matchAll(pattern).toArray().length, 0);
}

function codeLines(lines: string[], from: number, to: number): number {
    return lines.slice(from, to).filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
}

function isForwarding(fn: PythonFunction, call: Node): boolean {
    const names = parameterNames(fn);
    const given = (call.childForFieldName('arguments')?.namedChildren ?? []).map((argument) => argument.text);
    return names.length > 0 && given.join(',') === names.join(',');
}

function isInlineCandidate(fn: PythonFunction, allowed: Set<string>): boolean {
    if (!fn.isTopLevel || fn.isDecorated || RUNNER_NAMES.test(fn.name) || allowed.has(fn.name)) return false;
    const isTiny = fn.body.length > 0 && fn.body.length <= TRIVIAL_STATEMENTS;
    return isTiny && fn.body.every((statement) => statement.type !== 'raise_statement');
}

/**
 * Functions that pass their parameters straight to one other call.
 * @param functions every function of the run
 * @returns the problems
 */
export function callThroughs(functions: PythonFunction[]): StructureProblem[] {
    return functions.flatMap((fn) => {
        const call = forwardedCall(fn);
        if (call === undefined || fn.isDecorated || RUNNER_NAMES.test(fn.name) || !isForwarding(fn, call)) return [];
        const callee = call.childForFieldName('function')?.text ?? 'another function';
        return [
            problem(
                fn,
                'call-through',
                `${fn.name} passes its parameters straight to ${callee}. Call ${callee} directly.`,
            ),
        ];
    });
}

/**
 * Top-level functions of one or two statements that one place calls: the body belongs at that place.
 * @param modules every module of the run
 * @param functions every function of the run
 * @param allowed the names the policy allows
 * @returns the problems
 */
export function trivialFunctions(
    modules: PythonModule[],
    functions: PythonFunction[],
    allowed: Set<string>,
): StructureProblem[] {
    return functions
        .filter((fn) => isInlineCandidate(fn, allowed) && callCount(modules, fn.name) === ONE_CALLER_COUNT)
        .map((fn) =>
            problem(
                fn,
                'trivial-function',
                `${fn.name} holds ${String(fn.body.length)} statements and one place calls it. Inline it there.`,
            ),
        );
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
