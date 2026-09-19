// What a Swift function body says about the function: it forwards, it is tiny and called from one place, or it repeats another.
import type { Node } from 'web-tree-sitter';
import type { StructureProblem } from '#types/pyproject.ts';
import type { SwiftFunction, SwiftSource } from '#types/swift.ts';

const TRIVIAL_STATEMENTS = 2;
// The name followed by a bracket appears where the function is declared and where its one caller calls it.
const ONE_CALLER_COUNT = 2;

function problem(fn: SwiftFunction, rule: string, text: string): StructureProblem {
    return { file: fn.path, line: fn.node.startPosition.row + 1, rule, text };
}

// The call a body forwards to when it is one call, returned or bare, or undefined.
function forwardedCall(fn: SwiftFunction): Node | undefined {
    const [only, ...rest] = fn.body;
    if (only === undefined || rest.length > 0) return undefined;
    const value = only.type === 'control_transfer_statement' ? only.childForFieldName('result') : only;
    return value?.type === 'call_expression' ? value : undefined;
}

function passedArguments(call: Node): string[] {
    return call
        .descendantsOfType('value_argument')
        .filter((argument) => argument.parent?.parent?.parent?.id === call.id)
        .map((argument) => argument.childForFieldName('value')?.text ?? '');
}

function callCount(source: SwiftSource, name: string): number {
    const pattern = new RegExp(String.raw`(?<![\w])${name}\(`, 'gu');
    return source.text.matchAll(pattern).toArray().length;
}

function normalized(fn: SwiftFunction): string[] {
    return fn.body.flatMap((statement) =>
        statement.text
            .split('\n')
            .map((line) => line.trim().replaceAll(/\s+/gu, ' '))
            .filter((line) => line !== '' && !line.startsWith('//')),
    );
}

/**
 * Functions that pass their parameters straight to one other call.
 * @param functions every function of the run
 * @returns the problems
 */
export function callThroughs(functions: SwiftFunction[]): StructureProblem[] {
    return functions.flatMap((fn) => {
        const call = forwardedCall(fn);
        if (call === undefined || fn.isBound || fn.parameters.length === 0) return [];
        if (passedArguments(call).join(',') !== fn.parameters.join(',')) return [];
        const callee = call.namedChildren[0]?.text ?? 'another function';
        const text = `${fn.name} passes its parameters straight to ${callee}. Call ${callee} directly.`;
        return [problem(fn, 'call-through', text)];
    });
}

/**
 * File-local functions of one or two statements that one place calls: the body belongs at that place.
 * @param sources every source of the run
 * @param functions every function of the run
 * @param allowed the names the policy allows
 * @returns the problems
 */
export function trivialFunctions(
    sources: SwiftSource[],
    functions: SwiftFunction[],
    allowed: Set<string>,
): StructureProblem[] {
    const byPath = new Map(sources.map((source) => [source.path, source]));
    return functions.flatMap((fn) => {
        const source = byPath.get(fn.path);
        const isTiny = fn.body.length > 0 && fn.body.length <= TRIVIAL_STATEMENTS;
        if (source === undefined || !isTiny || !fn.isFileLocal || fn.isBound || allowed.has(fn.name)) return [];
        if (callCount(source, fn.name) !== ONE_CALLER_COUNT) return [];
        const text = `${fn.name} holds ${String(fn.body.length)} statement(s) and one place calls it. Write the body at that place.`;
        return [problem(fn, 'trivial-function', text)];
    });
}

/**
 * Groups of functions whose bodies match line for line, at or above a number of lines.
 * @param functions every function of the run
 * @param minimum the fewest body lines a repeated body holds
 * @returns one problem for each group
 */
export function duplicateFunctions(functions: SwiftFunction[], minimum: number): StructureProblem[] {
    const groups = new Map<string, SwiftFunction[]>();
    for (const fn of functions) {
        const lines = normalized(fn);
        if (lines.length < minimum) continue;
        const key = lines.join('\n');
        groups.set(key, [...(groups.get(key) ?? []), fn]);
    }
    return groups
        .values()
        .filter((group) => group.length > 1)
        .flatMap((group) => {
            const [first] = group;
            if (first === undefined) return [];
            const places = group.map((fn) => `${fn.path}:${String(fn.node.startPosition.row + 1)} (${fn.name})`);
            return [problem(first, 'same-body', `These functions have the same body: ${places.join(', ')}.`)];
        })
        .toArray();
}
