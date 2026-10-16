import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { extractStem } from '#cli/system/paths.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';
import { parseSource, selectGrammar } from '#cli/parsers/tree-sitter.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { extractSqlIdentifiers } from '#cli/checks/general/naming/sql.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { extractBashIdentifiers } from '#cli/checks/general/naming/bash.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { extractSwiftIdentifiers } from '#cli/checks/general/naming/swift.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { extractPythonIdentifiers } from '#cli/checks/general/naming/python.ts';
import { REST_SEGMENT, CATEGORY_LABELS } from '#cli/config/checks/general/naming.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These modules import hoisted functions and read no values during initialization.
import { extractTypescriptIdentifiers } from '#cli/checks/general/naming/typescript.ts';

import {
    type Identifier,
    type ExtractSink,
    type PathContainer,
    type NamedCategory,
    type IdentifierRead,
    type IdentifierDeclaration,
} from '#cli/types/checks/general.ts';

function parseSegmentName(
    segment: string,
    containers: PathContainer[],
): Pick<Identifier, 'name' | 'category'> | undefined {
    const bracket = containers.find((entry) => segment.startsWith(entry.open) && segment.endsWith(entry.close));
    if (bracket === undefined) return undefined;
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(REST_SEGMENT, ''), category: bracket.category };
}

/**
 * The file's own name as an identifier: the stem for most languages, the whole base name for a SQL migration.
 * @param path the repository-relative location that supplies the basename.
 * @param language the language configuration the file belongs to.
 * @param containers the selected configurations’ path punctuation.
 * @returns a spelling and category paired with the original file location.
 */
export function buildFileIdentifier(path: string, language: string, containers: PathContainer[]): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith(SQL_EXTENSION) ? base : extractStem(base);
    const named = parseSegmentName(
        name,
        containers.filter((container) => container.category !== 'folders'),
    ) ?? { name, category: 'files' };
    return createIdentifier({ file: path, language }, { line: 1, column: 1, ...named });
}

/**
 * Every directory on a file's path as an identifier, from the top down. Skip dot folders.
 * @param path the file path.
 * @param language the language configuration the file belongs to.
 * @param containers the selected configurations’ path punctuation.
 * @returns one entry for each nonempty parent segment that does not start with a dot.
 */
export function buildFolderIdentifiers(path: string, language: string, containers: PathContainer[]): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.')
            ? undefined
            : (parseSegmentName(segment, containers) ?? { name: segment, category: 'folders' });
        if (named === undefined || named.name === '') return [];
        const folder = segments.slice(0, index + 1).join('/');
        return [createIdentifier({ file: path, language }, { line: 1, column: 1, ...named, folder: folder })];
    });
}

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path.
 * @param text the file text.
 * @param language the language configuration the file belongs to.
 * @param context the execution reads and syntax tree resources.
 * @returns the identifiers in document order.
 */
export async function parseIdentifiers(
    file: string,
    text: string,
    language: string,
    context: Pick<CheckInput, 'reads' | 'resources'>,
): Promise<IdentifierRead> {
    if (language === 'sql') return extractSqlIdentifiers(file, text, context.reads);
    const grammar = selectGrammar(file, language);
    if (grammar === undefined) return { identifiers: [], error: undefined };
    const tree = await parseSource(grammar, text, context);
    try {
        let identifiers: Identifier[];
        switch (grammar) {
            case 'bash': {
                identifiers = extractBashIdentifiers(tree.rootNode, file);
                break;
            }
            case 'swift': {
                identifiers = extractSwiftIdentifiers(tree.rootNode, file);
                break;
            }
            case 'python': {
                identifiers = extractPythonIdentifiers(tree.rootNode, file);
                break;
            }
            default: {
                identifiers = extractTypescriptIdentifiers(tree.rootNode, file, language);
            }
        }
        return {
            identifiers: identifiers.toSorted((left, right) => left.line - right.line || left.column - right.column),
            error: undefined,
        };
    } finally {
        tree.delete();
    }
}

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
