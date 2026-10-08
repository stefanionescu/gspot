import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readSwift, disposeSwift } from '#cli/parsers/swift/source.ts';
import { trivialText, isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';

/**
 * Report trivial Swift functions and files, leaving closures in place.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function trivialFunctions(input: CheckInput): Promise<Finding[]> {
    const threshold = input.view.limit('min_function_statements', 'swift');
    if (threshold === undefined) return [];
    using parsed = await visitParsed(input, readSwift, disposeSwift);
    const { sources, functions } = parsed.value;
    return [
        ...functions.flatMap((definition) => {
            if (definition.node.type === 'lambda_literal') return [];
            const count = executableStatements(definition.body, 'swift');
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
        ...sources
            .filter((source) => isTrivialFile(source.tree.rootNode, 'swift', threshold))
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
