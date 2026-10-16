import { posix } from 'node:path';
import { extractStem } from '#cli/system/paths.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { sqlIdentifiers } from '#cli/checks/general/naming/sql.ts';
import { REST_SEGMENT } from '#cli/config/checks/general/naming.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';
import { bashIdentifiers } from '#cli/checks/general/naming/bash.ts';
import { swiftIdentifiers } from '#cli/checks/general/naming/swift.ts';
import { pythonIdentifiers } from '#cli/checks/general/naming/python.ts';
import { parseSource, selectGrammar } from '#cli/parsers/tree-sitter.ts';
import { createIdentifier } from '#cli/checks/general/naming/declarations.ts';
import type { Identifier, PathContainer } from '#cli/types/checks/general.ts';
import { typescriptIdentifiers } from '#cli/checks/general/naming/typescript.ts';

function segmentName(segment: string, containers: PathContainer[]): Pick<Identifier, 'name' | 'category'> | undefined {
    const bracket = containers.find((entry) => segment.startsWith(entry.open) && segment.endsWith(entry.close));
    if (bracket === undefined) return undefined;
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(REST_SEGMENT, ''), category: bracket.category };
}

/**
 * The file's own name as an identifier: the stem for most languages, the whole base name for a SQL migration.
 * @param path the file path.
 * @param language the language configuration the file belongs to.
 * @param containers the selected configurations’ path punctuation.
 * @returns the identifier.
 */
export function fileIdentifier(path: string, language: string, containers: PathContainer[]): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith(SQL_EXTENSION) ? base : extractStem(base);
    const named = segmentName(
        name,
        containers.filter((container) => container.category !== 'directories'),
    ) ?? { name, category: 'files' };
    return createIdentifier({ file: path, language }, { line: 1, column: 1, ...named });
}

/**
 * Every directory on a file's path as an identifier, from the top down. Skip dot folders.
 * @param path the file path.
 * @param language the language configuration the file belongs to.
 * @param containers the selected configurations’ path punctuation.
 * @returns the identifiers.
 */
export function directoryIdentifiers(path: string, language: string, containers: PathContainer[]): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.')
            ? undefined
            : (segmentName(segment, containers) ?? { name: segment, category: 'directories' });
        if (named === undefined || named.name === '') return [];
        const directory = segments.slice(0, index + 1).join('/');
        return [createIdentifier({ file: path, language }, { line: 1, column: 1, ...named, directory })];
    });
}

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path.
 * @param text the file text.
 * @param language the language configuration the file belongs to.
 * @param context optional execution reads and syntax tree resources.
 * @returns the identifiers in document order.
 */
export async function identifiersOf(
    file: string,
    text: string,
    language: string,
    context?: Pick<CheckInput, 'reads' | 'resources'>,
): Promise<Identifier[]> {
    if (language === 'sql') return sqlIdentifiers(file, text, context?.reads);
    const grammar = selectGrammar(file, language);
    if (grammar === undefined) return [];
    const tree = await parseSource(grammar, text, context);
    try {
        let identifiers: Identifier[];
        switch (grammar) {
            case 'bash': {
                identifiers = bashIdentifiers(tree.rootNode, file);
                break;
            }
            case 'swift': {
                identifiers = swiftIdentifiers(tree.rootNode, file);
                break;
            }
            case 'python': {
                identifiers = pythonIdentifiers(tree.rootNode, file);
                break;
            }
            default: {
                identifiers = typescriptIdentifiers(tree.rootNode, file, language);
            }
        }
        return identifiers.toSorted((left, right) => left.line - right.line || left.column - right.column);
    } finally {
        tree.delete();
    }
}
