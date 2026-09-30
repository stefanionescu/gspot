import { PLACEHOLDERS } from '#cli/config/checks/python.ts';
import { docstringOf } from '#cli/checks/python/modules.ts';
import type { PythonFunction, StructureProblem } from '#cli/types/checks.ts';
import { trivialFunctionText, executableStatements } from '#cli/checks/structure/statements.ts';
/**
 * Report every implemented function at or below the configured statement threshold.
 * @param functions the functions of a file
 * @param threshold the statement count at or under which a function is trivial
 * @returns one problem per trivial function
 */
export function trivialFunctions(functions: PythonFunction[], threshold: number): StructureProblem[] {
    return functions.flatMap((fn) => {
        const count = fn.node.type === 'lambda' ? 1 : executableStatements(fn.body, 'python');
        return count <= threshold
            ? [
                  {
                      file: fn.path,
                      line: fn.node.startPosition.row + 1,
                      rule: 'trivial-function',
                      text: trivialFunctionText(fn.name, count, threshold),
                  },
              ]
            : [];
    });
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
            {
                file: fn.path,
                line: fn.node.startPosition.row + 1,
                rule: 'placeholder-docstring',
                text: `The docstring of ${fn.name} says nothing the name does not. Say what the function does, or for whom.`,
            },
        ];
    });
}
