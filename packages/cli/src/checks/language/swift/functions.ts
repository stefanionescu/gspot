import { findingAt } from '#cli/execution/finding.ts';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import type { SwiftFunction } from '#cli/types/parsers/swift.ts';
import { trivialText, isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';

/**
 * Report trivial Swift functions and files, leaving closures in place.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function trivialFunctions(input: EngineInput): Promise<Finding[]> {
    const threshold = input.view.limit('min_function_statements', 'swift');
    if (threshold === undefined) return [];
    return visitSwiftSources(input, ({ sources, functions }) => [
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
    ]);
}

/**
 * Groups of matching function bodies that meet the minimum line count.
 * @param input the selected scope, files, and policy settings
 * @returns one finding for each group
 */
export async function duplicateFunctions(input: EngineInput): Promise<Finding[]> {
    const minimum = input.view.limit('identical_function_lines', 'swift');
    if (minimum === undefined) return [];
    return visitSwiftSources(input, ({ functions }) => {
        const groups = new Map<string, SwiftFunction[]>();
        for (const definition of functions) {
            const lines = definition.body.flatMap((statement) =>
                statement.text
                    .split('\n')
                    .map((line) => line.trim().replaceAll(/\s+/gu, ' '))
                    .filter((line) => line !== '' && !line.startsWith('//')),
            );
            if (lines.length < minimum) continue;
            const key = lines.join('\n');
            groups.set(key, [...(groups.get(key) ?? []), definition]);
        }
        return groups
            .values()
            .filter((group): group is [SwiftFunction, SwiftFunction, ...SwiftFunction[]] => group.length > 1)
            .map((group) => {
                const [first] = group;
                const places = group.map(
                    (definition) =>
                        `${definition.path}:${String(definition.node.startPosition.row + 1)} (${definition.name})`,
                );
                return findingAt(
                    input,
                    { file: first.path, line: first.node.startPosition.row + 1 },
                    'same-body',
                    `These functions have the same body: ${places.join(', ')}.`,
                );
            })
            .toArray();
    });
}
