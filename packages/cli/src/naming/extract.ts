import type { Identifier } from '#types/naming.ts';
import { grammarFor, parserFor } from '#cli/naming/parsers.ts';
// The identifiers of one file: parse it with the grammar its language names and run that language's extractor.
import { sqlIdentifiers } from '#cli/naming/extractors/sql.ts';
import { bashIdentifiers } from '#cli/naming/extractors/bash.ts';
import { typescriptIdentifiers } from '#cli/naming/extractors/typescript.ts';

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path
 * @param text the file text
 * @param language the language preset the file belongs to
 * @returns the identifiers
 */
export async function identifiersOf(file: string, text: string, language: string): Promise<Identifier[]> {
    if (language === 'sql') return sqlIdentifiers(file, text);
    const grammar = grammarFor(file, language);
    if (grammar === undefined) return [];
    const parser = await parserFor(grammar);
    const tree = parser.parse(text);
    if (tree === null) return [];
    try {
        return grammar === 'bash'
            ? bashIdentifiers(tree.rootNode, file)
            : typescriptIdentifiers(tree.rootNode, file, language);
    } finally {
        tree.delete();
    }
}
