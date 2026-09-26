import type { EngineInput } from '#cli/checks/input.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { sqlIdentifiers } from '#cli/checks/naming/extractors/sql.ts';
import { bashIdentifiers } from '#cli/checks/naming/extractors/bash.ts';
import { swiftIdentifiers } from '#cli/checks/naming/extractors/swift.ts';
import { pythonIdentifiers } from '#cli/checks/naming/extractors/python.ts';
import { typescriptIdentifiers } from '#cli/checks/naming/extractors/typescript.ts';

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

/** One identifier an extractor found. */
export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: string;
    /** The label a finding prints, such as `typescript function`. */
    kind: string;
    name: string;
    /** For a directory name: the directory path, so a path rule can match it. */
    directory?: string;
};

/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };
