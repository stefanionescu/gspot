import type { Session } from '#cli/types/session.ts';
import { remember } from '#cli/system/files/cache.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';
import { parseSource, selectGrammar } from '#cli/parsers/code/grammars.ts';
import { extractSqlIdentifiers } from '#cli/checks/general/naming/languages/sql.ts';
import { extractBashIdentifiers } from '#cli/checks/general/naming/languages/bash.ts';
import { extractSwiftIdentifiers } from '#cli/checks/general/naming/languages/swift.ts';
import { extractPythonIdentifiers } from '#cli/checks/general/naming/languages/python.ts';
import type { NamedFile, Identifier, IdentifierRead } from '#cli/types/checks/general/naming.ts';
import { extractTypescriptIdentifiers } from '#cli/checks/general/naming/languages/typescript.ts';

/**
List source files with the selected language configuration for each file.

@param planned the scope and its source files.
*/
export function listNamedFiles(planned: PlannedCheck): NamedFile[] {
    const languages = planned.scope.configurations
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
        .filter((named): named is NamedFile => named.language !== undefined);
}

const IDENTIFIERS = Symbol('identifiers');

/**
Lists the identifiers a file declares, or none when no extractor reads its language, once per session.

@param file the repository path of the source.
@param text the source to parse.
@param language the configuration that covers the file.
@param session the read cache and parser resources.
@returns the identifiers in source order, or a syntax error.
*/
export function parseIdentifiers(
    file: string,
    text: string,
    language: string,
    session: Pick<Session, 'reads' | 'resources'>,
): Promise<IdentifierRead> {
    return remember(session.reads, IDENTIFIERS, file, async (): Promise<IdentifierRead> => {
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
                identifiers: identifiers.toSorted(
                    (left, right) => left.line - right.line || left.column - right.column,
                ),
                error: undefined,
            };
        } finally {
            tree.delete();
        }
    });
}
