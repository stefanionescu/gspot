import { findingAt } from '#cli/execution/finding.ts';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { COMMENTS, DIRECTIVE } from '#cli/config/checks/language/swift.ts';

/**
 * Comments written among a file's imports, from the first import to the last. A tool directive is not a comment.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function importComments(input: EngineInput): Promise<Finding[]> {
    return visitSwiftSources(input, ({ sources }) =>
        sources.flatMap((source) => {
            const nodes = source.tree.rootNode.namedChildren;
            const imports = nodes.filter((node) => node.type === 'import_declaration');
            const [first] = imports;
            const last = imports.at(-1);
            if (first === undefined || last === undefined) return [];
            return nodes
                .filter(
                    (node) =>
                        COMMENTS.has(node.type) &&
                        node.startIndex > first.startIndex &&
                        node.startPosition.row <= last.endPosition.row &&
                        !DIRECTIVE.test(node.text),
                )
                .map((node) =>
                    findingAt(
                        input,
                        { file: source.path, line: node.startPosition.row + 1 },
                        'import-comment',
                        'No comments among imports. Say it where the import is used, or above the block.',
                    ),
                );
        }),
    );
}
