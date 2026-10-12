// Reads HTML tags and attribute values.
import type { Node } from 'web-tree-sitter';
import { SURROUNDING_QUOTES } from '#cli/config/text.ts';
import type { MarkupAttribute } from '#cli/types/parsers/tree-sitter.ts';

/**
 * Read the tag attributes while their source tree remains borrowed.
 * @param element the parsed element.
 * @returns its tag, attribute names, values, and source nodes.
 */
export function elementAttributes(element: Node): MarkupAttribute[] {
    const tag = element.namedChildren.find((child) => child.type === 'start_tag' || child.type === 'self_closing_tag');
    const name = tag?.namedChildren.find((child) => child.type === 'tag_name')?.text.toLowerCase() ?? '';
    return (tag?.namedChildren ?? [])
        .filter((child) => child.type === 'attribute')
        .map((node) => ({
            node,
            element: name,
            name: node.namedChildren[0]?.text.toLowerCase() ?? '',
            value: (node.namedChildren[1]?.text ?? '').replaceAll(SURROUNDING_QUOTES, ''),
        }));
}
