import type { Node } from 'web-tree-sitter';

import { NAME_QUOTE } from '#cli/config/configurations/naming.ts';
import type { FileIdentifiers, NamedCategory } from '#cli/types/configurations/naming.ts';

export function addIdentifier(
    found: FileIdentifiers,
    node: Node,
    category: NamedCategory,
    name = node.text.replaceAll(NAME_QUOTE, ''),
): void {
    if (name === '' || name === '_') return;
    found.identifiers.push({
        file: found.file,
        language: found.language,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        category,
        name,
    });
}
