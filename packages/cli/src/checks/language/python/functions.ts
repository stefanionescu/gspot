import { findingAt } from '#cli/execution/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { PLACEHOLDERS } from '#cli/config/checks/language/python.ts';
import { docstringOf, visitPythonModules } from '#cli/parsers/python/source.ts';
import { trivialText, isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';

/**
 * Report trivial Python functions and files, leaving lambdas in place.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function trivialFunctions(input: EngineInput): Promise<Finding[]> {
    const threshold = input.view.limit('min_function_statements', 'python');
    if (threshold === undefined) return [];
    return visitPythonModules(input, ({ modules, functions }) => [
        ...functions.flatMap((definition) => {
            if (definition.node.type === 'lambda') return [];
            const count = executableStatements(definition.body, 'python');
            return count <= threshold
                ? [
                      findingAt(
                          input,
                          { file: definition.path, line: definition.node.startPosition.row + 1 },
                          'trivial-function',
                          trivialText(definition.name, count, threshold),
                      ),
                  ]
                : [];
        }),
        ...modules
            .filter((source) => isTrivialFile(source.tree.rootNode, 'python', threshold))
            .map((source) =>
                findingAt(
                    input,
                    {
                        file: source.path,
                        line:
                            (source.tree.rootNode.namedChildren.find((node) => !node.type.includes('comment'))
                                ?.startPosition.row ?? 0) + 1,
                    },
                    'trivial-file',
                    'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                ),
            ),
    ]);
}

/**
 * Report Python docstrings that only repeat a name or placeholder.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function placeholderDocstrings(input: EngineInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ functions }) =>
        functions.flatMap((definition) => {
            const text = docstringOf(definition.node);
            if (text === undefined) return [];
            const plain = text
                .toLowerCase()
                .replaceAll(/[^a-z\d]+/gu, ' ')
                .trim();
            const isName = plain === definition.name.toLowerCase().replaceAll('_', ' ').trim();
            if (plain !== '' && !isName && !PLACEHOLDERS.has(plain)) return [];
            return [
                findingAt(
                    input,
                    { file: definition.path, line: definition.node.startPosition.row + 1 },
                    'placeholder-docstring',
                    `The docstring of ${definition.name} says nothing the name does not. Say what the function does, or for whom.`,
                ),
            ];
        }),
    );
}
