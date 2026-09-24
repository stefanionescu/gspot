// The parsed Swift files of one run, and the functions they declare.
import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { SwiftFunction, SwiftSource } from '#cli/structure/swift/types.ts';

function modifiersOf(node: Node): Node[] {
    return node.namedChildren.filter((child) => child.type === 'modifiers').flatMap((child) => child.namedChildren);
}

function bodyOf(node: Node): Node[] {
    const statements = (node.childForFieldName('body') ?? node).namedChildren.find(
        (child) => child.type === 'statements',
    );
    return (statements?.namedChildren ?? []).filter((child) => !child.type.endsWith('comment'));
}

/**
 * The visibility word a declaration carries, or internal when it carries none.
 * @param node the declaration
 * @returns private, fileprivate, internal, public, package, or open
 */
export function visibilityOf(node: Node): string {
    const word = modifiersOf(node).find((modifier) => modifier.type === 'visibility_modifier')?.text ?? 'internal';
    return word.replace(/\(set\)$/u, '').trim();
}

/**
 * Parses every claimed Swift source file.
 * @param input the engine input
 * @returns the sources
 */
export async function swiftSources(input: Pick<EngineInput, 'root' | 'files' | 'observations' | 'resources'>): Promise<SwiftSource[]> {
    const sources: SwiftSource[] = [];
    try {
        for (const file of input.files) {
            if (file.nature !== 'source' || !file.path.endsWith('.swift')) continue;
            const text = readSource(input.root, file.path, input.observations).toString('utf8');
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
 * Every function a source declares, at the top level and inside types.
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
        .flatMap((node) => {
            if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
                return [];
            const name = node.childForFieldName('name');
            if (node.type === 'function_declaration' && node.childForFieldName('body') === null) return [];
            return [
                {
                    path: source.path,
                    node,
                    name: name?.text ?? node.type,
                    body: bodyOf(node),
                },
            ];
        });
}
