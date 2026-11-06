import type { Node } from 'web-tree-sitter';

import { CATEGORY_LABELS, NAME_QUOTE } from '#cli/config/configurations/naming.ts';
import type { FileIdentifiers, NamedCategory } from '#cli/types/configurations/general.ts';

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
        label: `${found.language} ${CATEGORY_LABELS[category]}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        category,
        name,
    });
}
