import type { Node } from 'web-tree-sitter';
import { CATEGORY_LABELS } from '#cli/config/checks/general/naming.ts';
import type { Identifier, ExtractSink, NamedCategory, IdentifierDeclaration } from '#cli/types/checks/general.ts';

/**
 * Build a declaration with its source file and the label findings display.
 * @param source the source file and selected language.
 * @param declaration the declaration's name, category, and location.
 * @returns the declaration labeled with its language.
 */
export function createIdentifier(
    source: Pick<ExtractSink, 'file' | 'language'>,
    declaration: IdentifierDeclaration,
): Identifier {
    const label = CATEGORY_LABELS[declaration.category];
    return { ...declaration, file: source.file, language: source.language, label: `${source.language} ${label}` };
}

/**
 * Add a declaration at its source location. Omit empty names and `_`.
 * @param sink the source file and its collected declarations.
 * @param node the declaration's source node.
 * @param category the naming category.
 * @param name the authored name, after any language-specific spelling change.
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
