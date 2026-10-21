import type { Node } from 'web-tree-sitter';
import { CATEGORY_LABELS } from '#cli/config/checks/naming.ts';
import type { NamedCategory } from '#cli/types/settings/tables.ts';
import type { Identifier, ExtractSink } from '#cli/types/checks/naming.ts';

/**
 * Builds an identifier with its file and the label that findings show.
 *
 * @param source the file and its language.
 * @param declaration what the code declares, and where.
 * @returns the labeled identifier.
 */
export function createIdentifier(
    source: Pick<ExtractSink, 'file' | 'language'>,
    declaration: Omit<Identifier, 'file' | 'language' | 'label'>,
): Identifier {
    const label = CATEGORY_LABELS[declaration.category];
    return { ...declaration, file: source.file, language: source.language, label: `${source.language} ${label}` };
}

/**
 * Adds an identifier at its source place, except an empty name or `_`.
 *
 * @param sink the file and the identifiers found so far.
 * @param node the parsed declaration.
 * @param category the kind of declared name.
 * @param name the authored spelling, after any language change.
 */
export function addIdentifier(sink: ExtractSink, node: Node, category: NamedCategory, name = node.text): void {
    if (name === '' || name === '_') return;
    sink.out.push(
        createIdentifier(sink, {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
            category,
            name,
        }),
    );
}
