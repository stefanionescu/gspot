// The parsed Swift files of one run, and the functions they declare.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Node } from 'web-tree-sitter';
import type { EngineInput } from '#types/run.ts';
import { parserFor } from '#cli/naming/parsers.ts';
import type { SwiftFunction, SwiftSource } from '#types/swift.ts';

const FILE_LOCAL = new Set(['private', 'fileprivate']);

function modifiersOf(node: Node): Node[] {
    return node.namedChildren.filter((child) => child.type === 'modifiers').flatMap((child) => child.namedChildren);
}

function bodyOf(node: Node): Node[] {
    const statements = node.childForFieldName('body')?.namedChildren.find((child) => child.type === 'statements');
    return (statements?.namedChildren ?? []).filter((child) => !child.type.endsWith('comment'));
}

function parameterNames(node: Node): string[] {
    return node.namedChildren
        .filter((child) => child.type === 'parameter')
        .flatMap((parameter) => {
            const local = parameter.childrenForFieldName('name').find((child) => child.type === 'simple_identifier');
            return local === undefined ? [] : [local.text];
        });
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
export async function swiftSources(input: EngineInput): Promise<SwiftSource[]> {
    const parser = await parserFor('swift');
    const sources: SwiftSource[] = [];
    for (const file of input.files) {
        if (file.nature !== 'source' || !file.path.endsWith('.swift')) continue;
        const text = readFileSync(join(input.root, file.path), 'utf8');
        const tree = parser.parse(text);
        if (tree !== null) sources.push({ path: file.path, text, lines: text.split('\n'), tree });
    }
    return sources;
}

/**
 * Every function a source declares, at the top level and inside types.
 * @param source the parsed file
 * @returns the functions
 */
export function functionsOf(source: SwiftSource): SwiftFunction[] {
    return source.tree.rootNode.descendantsOfType('function_declaration').flatMap((node) => {
        const name = node.childForFieldName('name');
        if (name?.type !== 'simple_identifier') return [];
        const modifiers = modifiersOf(node);
        const isBound = modifiers.some((modifier) => modifier.type === 'attribute' || modifier.text === 'override');
        return [
            {
                path: source.path,
                node,
                name: name.text,
                body: bodyOf(node),
                parameters: parameterNames(node),
                isFileLocal: FILE_LOCAL.has(visibilityOf(node)),
                isBound,
            },
        ];
    });
}
