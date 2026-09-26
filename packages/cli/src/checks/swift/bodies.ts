import type { SwiftFunction } from '#cli/checks/swift/types.ts';
import type { StructureProblem } from '#cli/checks/structure/engine.ts';
import { executableStatements } from '#cli/checks/structure/statements.ts';

function problem(fn: SwiftFunction, rule: string, text: string): StructureProblem {
    return { file: fn.path, line: fn.node.startPosition.row + 1, rule, text };
}

/**
 * Report every implemented function at or below the configured statement threshold.
 * @param functions
 * @param threshold
 */
export function trivialFunctions(functions: SwiftFunction[], threshold: number): StructureProblem[] {
    return functions.flatMap((fn) => {
        const count = fn.node.type === 'lambda' ? 1 : executableStatements(fn.body, 'swift');
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

function normalized(fn: SwiftFunction): string[] {
    return fn.body.flatMap((statement) =>
        statement.text
            .split('\n')
            .map((line) => line.trim().replaceAll(/\s+/gu, ' '))
            .filter((line) => line !== '' && !line.startsWith('//')),
    );
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
