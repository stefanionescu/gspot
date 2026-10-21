import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFileMatcher } from '#cli/repository/covered-files.ts';
import { parseSource, selectGrammar } from '#cli/parsers/grammars.ts';
import { extractSqlIdentifiers } from '#cli/checks/naming/languages/sql.ts';
import { extractBashIdentifiers } from '#cli/checks/naming/languages/bash.ts';
import { extractSwiftIdentifiers } from '#cli/checks/naming/languages/swift.ts';
import { extractPythonIdentifiers } from '#cli/checks/naming/languages/python.ts';
import type { NamedFile, Identifier, IdentifierRead } from '#cli/types/checks/naming.ts';
import { extractTypescriptIdentifiers } from '#cli/checks/naming/languages/typescript.ts';

/**
 * List source files with the selected language configuration for each file.
 *
 * @param planned the selected check, configuration manifests, and source files.
 * @returns the source files and their language names.
 */
export function listNamedFiles(planned: PlannedCheck): NamedFile[] {
    const languages = planned.selection.selected
        .filter((configuration) => configuration.group === 'language')
        .map((configuration) => ({
            configuration,
            matches: buildFileMatcher(configuration.files),
        }));
    return planned.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find(({ matches }) => matches(file))?.configuration.name,
        }))
        .filter((entry): entry is NamedFile => entry.language !== undefined);
}

/**
 * Lists the identifiers a file declares, or none when no extractor reads its language.
 *
 * @param file the repository path of the source.
 * @param text the source to parse.
 * @param language the configuration that covers the file.
 * @param session the read cache and parser resources.
 * @returns the identifiers in source order, or a syntax error.
 */
export async function parseIdentifiers(
    file: string,
    text: string,
    language: string,
    session: Pick<Session, 'reads' | 'resources'>,
): Promise<IdentifierRead> {
    if (language === 'sql') return extractSqlIdentifiers(file, text, session.reads);
    const grammar = selectGrammar(file, language);
    if (grammar === undefined) return { identifiers: [], error: undefined };
    const tree = await parseSource(grammar, text, session);
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
