import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { PLACEHOLDERS } from '#cli/config/checks/language/python.ts';
import { readPython, docstringOf, disposePython } from '#cli/parsers/python.ts';
import { trivialText, isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';

/**
 * Report trivial Python functions and files, leaving lambdas in place.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function trivialFunctions(input: CheckInput): Promise<Finding[]> {
    const threshold = input.view.limit('min_function_statements', 'python');
    if (threshold === undefined) return [];
    using parsed = await visitParsed(input, readPython, disposePython);
    const { modules, functions } = parsed.value;
    return [
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
    ];
}

/**
 * Report Python docstrings that only repeat a name or placeholder.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function placeholderDocstrings(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readPython, disposePython);
    const { functions } = parsed.value;
    return functions.flatMap((definition) => {
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
    });
}
