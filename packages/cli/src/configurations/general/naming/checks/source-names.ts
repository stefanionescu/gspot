import { extractBashIdentifiers } from '#cli/configurations/general/naming/languages/bash.ts';
import { extractPythonIdentifiers } from '#cli/configurations/general/naming/languages/python.ts';
import { extractSqlIdentifiers } from '#cli/configurations/general/naming/languages/sql.ts';
import { extractSwiftIdentifiers } from '#cli/configurations/general/naming/languages/swift.ts';
import { extractTypescriptIdentifiers } from '#cli/configurations/general/naming/languages/typescript.ts';
import { parseSource, selectGrammar } from '#cli/parsers/code/grammars.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';
import { remember } from '#cli/system/cache.ts';
import type { Identifier, IdentifierRead, NamedFile } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Session } from '#cli/types/tools.ts';

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

export function parseIdentifiers(
    file: string,
    text: string,
    language: string,
    session: Pick<Session, 'cache' | 'resources'>,
): Promise<IdentifierRead> {
    return remember(session.cache, IDENTIFIERS, file, async (): Promise<IdentifierRead> => {
        if (language === 'sql') return extractSqlIdentifiers(file, text, session.cache);
        const grammar = selectGrammar(file, language);
        if (grammar === undefined) return { identifiers: [], error: undefined };
        using tree = await parseSource(grammar, text, session);
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
    });
}
