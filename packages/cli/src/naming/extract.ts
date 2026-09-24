import type { EngineInput } from '#cli/types/execution.ts';
import type { Identifier } from '#cli/types/naming.ts';
// The identifiers of one file: parse it with the grammar its language names and run that language's extractor.
import { sqlIdentifiers } from '#cli/naming/extractors/sql.ts';
import { bashIdentifiers } from '#cli/naming/extractors/bash.ts';
import { swiftIdentifiers } from '#cli/naming/extractors/swift.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { pythonIdentifiers } from '#cli/naming/extractors/python.ts';
import { typescriptIdentifiers } from '#cli/naming/extractors/typescript.ts';

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path
 * @param text the file text
 * @param language the language configuration the file belongs to
 * @param context optional execution observations and their resource owner
 * @returns the identifiers
 */
export async function identifiersOf(
    file: string,
    text: string,
    language: string,
    context?: Pick<EngineInput, 'observations' | 'resources'>,
): Promise<Identifier[]> {
    if (language === 'sql') return sqlIdentifiers(file, text, context?.observations);
    const grammar = grammarFor(file, language);
    if (grammar === undefined) return [];
    const tree = await parseSource(grammar, text, context);
    if (tree === null) throw new Error('The source parser returned no tree.');
    try {
        if (grammar === 'bash') return bashIdentifiers(tree.rootNode, file);
        if (grammar === 'swift') return swiftIdentifiers(tree.rootNode, file);
        if (grammar === 'python') return pythonIdentifiers(tree.rootNode, file);
        return typescriptIdentifiers(tree.rootNode, file, language);
    } finally {
        tree.delete();
    }
}
