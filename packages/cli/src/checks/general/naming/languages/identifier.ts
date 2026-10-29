import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/naming.ts';
import type { FileIdentifiers } from '#cli/types/checks/general/naming.ts';
import { NAME_QUOTE, CATEGORY_LABELS } from '#cli/config/checks/general/naming/languages/identifier.ts';

/**
Adds an identifier at its source place, except an empty name or `_`.

@param found the file and the identifiers found so far.
@param node the parsed declaration.
@param category the kind of declared name.
@param name the name as written, after any language change.
*/
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
