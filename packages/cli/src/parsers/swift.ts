import type { Node } from 'web-tree-sitter';
import { readSource } from '#cli/platform/source.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { SourceInput } from '#cli/types/parsers/source.ts';
import type { ParsedSwift, SwiftSource, SwiftFunction } from '#cli/types/parsers/swift.ts';
import { ACCESSOR_NODES, FUNCTION_NAMES, SWIFT_BODY_NODES } from '#cli/config/parsers/swift.ts';

function accessorName(node: Node, label: string): string {
    let owner = node.parent;
    while (owner !== null && !['property_declaration', 'subscript_declaration'].includes(owner.type))
        owner = owner.parent;
    if (owner === null) return label;
    const name = owner.type === 'subscript_declaration' ? 'subscript' : owner.childForFieldName('name')?.text;
    return name === undefined ? label : `${label} of ${name}`;
}

/**
 * Read selected Swift sources and their function observations.
 * @param input the selected files and source reads
 * @returns parsed observations whose trees must be disposed
 */
export async function readSwift(input: SourceInput): Promise<ParsedSwift> {
    const sources: SwiftSource[] = [];
    try {
        for (const file of input.files) {
            if (file.kind !== 'source' || !file.path.endsWith('.swift')) continue;
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            const tree = await parseSource('swift', text, input);
            sources.push({ path: file.path, text, lines: text.split('\n'), tree });
        }
        return { sources, functions: sources.flatMap((source) => getSwiftFunctions(source)) };
    } catch (error) {
        for (const source of sources) source.tree.delete();
        throw error;
    }
}

/**
 * Read functions, nested functions, accessors, observers, and closures from one Swift source.
 * @param source the parsed file
 * @returns executable bodies with names suitable for findings
 */
export function getSwiftFunctions(source: SwiftSource): SwiftFunction[] {
    return source.tree.rootNode
        .descendantsOfType(SWIFT_BODY_NODES)
        .filter((node) => {
            if (node.type === 'computed_property' && !node.namedChildren.some((child) => child.type === 'statements'))
                return false;
            return node.type !== 'function_declaration' || node.childForFieldName('body') !== null;
        })
        .map((node) => {
            const statements = (node.childForFieldName('body') ?? node).namedChildren.find(
                (child) => child.type === 'statements',
            );
            let name = node.childForFieldName('name')?.text ?? FUNCTION_NAMES[node.type] ?? 'function';
            if (ACCESSOR_NODES.has(node.type)) name = accessorName(node, name);
            return {
                path: source.path,
                node,
                name,
                body: (statements?.namedChildren ?? []).filter((child) => !child.type.endsWith('comment')),
            };
        });
}

/**
 * Release the tree handles owned by Swift observations.
 * @param parsed the observations whose readers have finished
 */
export function disposeSwift(parsed: ParsedSwift): void {
    for (const source of parsed.sources) source.tree.delete();
}
