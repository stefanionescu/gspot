import { CATEGORY_LABELS } from '#cli/config/parsers/naming.ts';
import type { Identifier, ExtractSink, IdentifierDeclaration } from '#cli/types/parsers/naming.ts';

/**
 * Build a declaration with its source owner and the label findings display.
 * @param source the source file and selected language
 * @param declaration the declaration's name, category, and location
 * @returns the declaration labeled with its language
 */
export function createIdentifier(
    source: Pick<ExtractSink, 'file' | 'language'>,
    declaration: IdentifierDeclaration,
): Identifier {
    const label = CATEGORY_LABELS[declaration.category] ?? declaration.category;
    return { ...declaration, file: source.file, language: source.language, kind: `${source.language} ${label}` };
}
