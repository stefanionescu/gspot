import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/execution/finding.ts';
import { visitSwiftSources } from '#cli/parsers/swift.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { FILE_LOCAL, DECLARATIONS } from '#cli/config/checks/language/swift.ts';

/**
 * The visibility word a declaration carries, or internal when it carries none.
 * @param node the declaration
 * @returns private, fileprivate, internal, public, package, or open
 */
function visibilityOf(node: Node): string {
    const word =
        node.namedChildren
            .filter((child) => child.type === 'modifiers')
            .flatMap((child) => child.namedChildren)
            .find((modifier) => modifier.type === 'visibility_modifier' && !modifier.text.endsWith('(set)'))?.text ??
        'internal';
    return word.trim();
}

/**
 * Top-level declarations that are private or fileprivate and sit below one that other files see.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function privateBeforePublic(input: EngineInput): Promise<Finding[]> {
    return visitSwiftSources(input, ({ sources }) =>
        sources.flatMap((source) => {
            const declarations = source.tree.rootNode.namedChildren.filter((child) => DECLARATIONS.has(child.type));
            const firstShared = declarations.findIndex((node) => !FILE_LOCAL.has(visibilityOf(node)));
            if (firstShared === -1) return [];
            return declarations
                .slice(firstShared + 1)
                .filter((node) => FILE_LOCAL.has(visibilityOf(node)))
                .map((node) => {
                    // An extension names the type it extends, so identify the extension itself in the finding.
                    const name = node.childForFieldName('name')?.text ?? 'This declaration';
                    const title =
                        node.childForFieldName('declaration_kind')?.text === 'extension'
                            ? `The extension of ${name}`
                            : name;
                    return findingAt(
                        input,
                        { file: source.path, line: node.startPosition.row + 1 },
                        'private-before-public',
                        `${title} is ${visibilityOf(node)} and sits below a declaration other files see. File-local declarations come first.`,
                    );
                });
        }),
    );
}
