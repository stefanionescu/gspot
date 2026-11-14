import { remember } from '#cli/system/cache.ts';
import type { Session } from '#cli/types/tools.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { selectGrammar } from '#cli/configurations/syntax.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { buildFileMatcher } from '#cli/repository/files/selection.ts';
import type { NamedFile, Identifier, IdentifierRead } from '#cli/types/configurations/naming.ts';
import { extractSqlIdentifiers } from '#cli/configurations/general/naming/checks/languages/sql.ts';
import { extractBashIdentifiers } from '#cli/configurations/general/naming/checks/languages/bash.ts';
import { extractSwiftIdentifiers } from '#cli/configurations/general/naming/checks/languages/swift.ts';
import { extractPythonIdentifiers } from '#cli/configurations/general/naming/checks/languages/python.ts';
import { extractTypescriptIdentifiers } from '#cli/configurations/general/naming/checks/languages/typescript.ts';

export function listNamedFiles(planned: PlannedCheck): NamedFile[] {
    const languages = planned.scope.configurations
        .filter((configuration) => configuration.group === 'language' && !configuration.always_selected)
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
