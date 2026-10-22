import type { Node } from 'web-tree-sitter';
import type { NamedCategory } from '#cli/types/settings/tables.ts';
import type { Identifier, FileIdentifiers } from '#cli/types/checks/general/naming.ts';
import { CATEGORY_LABELS } from '#cli/config/checks/general/naming/languages/identifier.ts';

/**
 * Builds an identifier with its file and the label that findings show.
 *
 * @param source the file and its language.
 * @param declaration what the code declares, and where.
 * @returns the labeled identifier.
 */
export function createIdentifier(
    source: Pick<FileIdentifiers, 'file' | 'language'>,
    declaration: Omit<Identifier, 'file' | 'language' | 'label'>,
): Identifier {
    const label = CATEGORY_LABELS[declaration.category];
    return { ...declaration, file: source.file, language: source.language, label: `${source.language} ${label}` };
}

/**
 * Adds an identifier at its source place, except an empty name or `_`.
 *
 * @param found the file and the identifiers found so far.
 * @param node the parsed declaration.
 * @param category the kind of declared name.
 * @param name the name as written, after any language change.
 */
export function addIdentifier(found: FileIdentifiers, node: Node, category: NamedCategory, name = node.text): void {
    if (name === '' || name === '_') return;
    found.out.push(
        createIdentifier(found, {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            category,
            name,
        }),
    );
}
