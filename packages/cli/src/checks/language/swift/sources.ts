import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/repository/sources.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import type { SwiftSource, SwiftFunction } from '#cli/types/checks/language/swift.ts';

/**
 * The visibility word a declaration carries, or internal when it carries none.
 * @param node the declaration
 * @returns private, fileprivate, internal, public, package, or open
 */
export function visibilityOf(node: Node): string {
    const word =
        node.namedChildren
            .filter((child) => child.type === 'modifiers')
            .flatMap((child) => child.namedChildren)
            .find((modifier) => modifier.type === 'visibility_modifier')?.text ?? 'internal';
    return word.replace(/\(set\)$/u, '').trim();
}

/**
 * Parses every owned Swift source file.
 * @param input the engine input
 * @returns the sources
 */
export async function swiftSources(
    input: Pick<EngineInput, 'root' | 'files' | 'reads' | 'resources'>,
): Promise<SwiftSource[]> {
    const sources: SwiftSource[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith('.swift')) continue;
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            const tree = await parseSource('swift', text, input);
            if (tree === null) throw new Error('The Swift parser returned no tree.');
            sources.push({ path: file.path, text, lines: text.split('\n'), tree });
        }
    } catch (error) {
        for (const source of sources) source.tree.delete();
        throw error;
    }
    return sources;
}

/**
 * Every function declared at the top level or inside a type.
 * @param source the parsed file
 * @returns the functions
 */
export function functionsOf(source: SwiftSource): SwiftFunction[] {
    return source.tree.rootNode
        .descendantsOfType([
            'function_declaration',
            'init_declaration',
            'deinit_declaration',
            'lambda_literal',
            'computed_getter',
            'computed_setter',
            'computed_property',
            'willset_clause',
            'didset_clause',
        ])
        .filter((node) => {
            if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
                return false;
            return node.type !== 'function_declaration' || node.childForFieldName('body') !== null;
        })
        .map((node) => {
            const name = node.childForFieldName('name');
            const statements = (node.childForFieldName('body') ?? node).namedChildren.find(
                (child) => child.type === 'statements',
            );
            return {
                path: source.path,
                node,
                name: name?.text ?? node.type,
                body: (statements?.namedChildren ?? []).filter((child) => !child.type.endsWith('comment')),
            };
        });
}
