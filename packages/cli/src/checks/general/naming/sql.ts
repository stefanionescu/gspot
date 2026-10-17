import { computePosition } from '#cli/system/text.ts';
import { listSqlTokens } from '#cli/parsers/sql/lexer.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createIdentifier } from '#cli/checks/general/naming/collect.ts';
import type { SqlFile, SqlStatementView, SqlStatementReaders } from '#cli/types/parsers/sql.ts';
import { type SqlNamed, type Identifier, type IdentifierRead } from '#cli/types/checks/general.ts';
import { parseSqlFile, listNameParts, readStatement, listNodeFields } from '#cli/parsers/sql/postgres.ts';

import {
    SQL_NAME_TOKEN,
    SQL_QUALIFIED_NAME,
    SQL_PARAMETER_DEPTH,
    SQL_PARAMETER_PREFIX,
    SQL_TABLE_PARAMETERS,
    SQL_DECLARATION_PREFIX,
} from '#cli/config/parsers/sql.ts';

function listAddedColumns({ fields }: SqlStatementView<'AlterTableStmt'>): SqlNamed[] {
    return listNodeFields(fields.cmds, 'AlterTableCmd')
        .filter((command) => command.subtype === 'AT_AddColumn')
        .flatMap((command) =>
            listNodeFields(command.def === undefined ? [] : [command.def], 'ColumnDef').map((column) => ({
                category: 'columns',
                name: column.colname ?? '',
                ...(column.location === undefined ? {} : { location: column.location }),
            })),
        );
}

const NAME_READERS: SqlStatementReaders<SqlNamed[]> = {
    CreateSchemaStmt: ({ fields }) => [{ category: 'schemas', name: fields.schemaname ?? '' }],
    CreateStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.relation?.relname ?? '',
            ...(fields.relation?.location === undefined ? {} : { location: fields.relation.location }),
        },
        ...listNodeFields(fields.tableElts, 'ColumnDef').map<SqlNamed>((column) => ({
            category: 'columns',
            name: column.colname ?? '',
            ...(column.location === undefined ? {} : { location: column.location }),
        })),
    ],
    ViewStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.view?.relname ?? '',
            ...(fields.view?.location === undefined ? {} : { location: fields.view.location }),
        },
    ],
    AlterTableStmt: listAddedColumns,
    IndexStmt: ({ fields }) => [{ category: 'indexes', name: fields.idxname ?? '' }],
    CreateTrigStmt: ({ fields }) => [{ category: 'triggers', name: fields.trigname ?? '' }],
    CreatePolicyStmt: ({ fields }) => [{ category: 'policies', name: fields.policy_name ?? '' }],
};

function scanParameterList(source: string, start: number): { spans: number[]; span: number; end: number } {
    const spans: number[] = [];
    const literals = new Map(
        [...listSqlTokens(source.slice(start))].map((token) => [token.start + start, token.end + start]),
    );
    let span = start;
    let depth = 0;
    let at = start;
    while (at < source.length) {
        const next = literals.get(at) ?? at + 1;
        const character = source.slice(at, next);
        if (character === ')' && depth === 0) break;
        depth += SQL_PARAMETER_DEPTH.get(character) ?? 0;
        if (character === ',' && depth === 0) {
            spans.push(span);
            span = at + 1;
        }
        at = next;
    }
    return { spans, span, end: at };
}

function parseParameterSpans(source: string, start: number): { spans: number[]; end: number } {
    const scanned = scanParameterList(source, start);
    if (source.slice(scanned.span, scanned.end).trim() !== '') scanned.spans.push(scanned.span);
    return { spans: scanned.spans, end: scanned.end + 1 };
}

function findFunctionName(statement: SqlStatementView<'CreateFunctionStmt'>, source: string) {
    let start = statement.start + (SQL_DECLARATION_PREFIX.exec(source.slice(statement.start))?.[0].length ?? 0);
    start += source.slice(start).length - source.slice(start).trimStart().length;
    const qualified = SQL_QUALIFIED_NAME.exec(source.slice(start))?.[0] ?? '';
    const lastPart = [...qualified.matchAll(SQL_NAME_TOKEN)].at(-1);
    return { start, qualified, offset: start + (lastPart?.index ?? 0) };
}

function listFunctionNames(statement: SqlStatementView<'CreateFunctionStmt'>, source: string): SqlNamed[] {
    const { start, qualified, offset } = findFunctionName(statement, source);
    const names: SqlNamed[] = [
        {
            category: 'functions',
            name: listNameParts(statement.fields.funcname).at(-1) ?? '',
            offset,
        },
    ];
    const open = source.indexOf('(', start + qualified.length);
    const input = parseParameterSpans(source, open + 1);
    const output = SQL_TABLE_PARAMETERS.exec(source.slice(input.end));
    const spans =
        output === null
            ? input.spans
            : [...input.spans, ...parseParameterSpans(source, input.end + output[0].length).spans];
    for (const [index, parameter] of listNodeFields(statement.fields.parameters, 'FunctionParameter').entries()) {
        const span = spans[index];
        if (span === undefined) continue;
        names.push({
            category: 'parameters',
            name: parameter.name ?? '',
            offset: span + (SQL_PARAMETER_PREFIX.exec(source.slice(span))?.[0].length ?? 0),
        });
    }
    return names;
}

function findNamedToken(source: string, name: string, offset: number): number {
    const token = [...source.slice(offset).matchAll(SQL_NAME_TOKEN)].find((match) => {
        const text = match[0];
        return text.startsWith('"') ? text.slice(1, -1).replaceAll('""', '"') === name : text.toLowerCase() === name;
    });
    return token === undefined ? -1 : offset + token.index;
}

function findIdentifierOffset(entry: SqlNamed, parsed: SqlFile, source: string, offset: number): number {
    if (entry.offset !== undefined) return entry.offset;
    if (entry.location === undefined || entry.location < 0) return findNamedToken(source, entry.name, offset);
    let found = Buffer.from(parsed.source).subarray(0, entry.location).toString('utf8').length;
    if (entry.category === 'tables') {
        const qualified = SQL_QUALIFIED_NAME.exec(source.slice(found))?.[0] ?? '';
        const last = [...qualified.matchAll(SQL_NAME_TOKEN)].at(-1);
        if (last !== undefined) found += last.index;
    }
    return found;
}

function extractStatementIdentifiers({
    file,
    source,
    statement,
    parsed,
    lexicalSource,
}: {
    file: string;
    source: string;
    statement: SqlStatementView;
    parsed: SqlFile;
    lexicalSource: string;
}): Identifier[] {
    const named =
        statement.kind === 'CreateFunctionStmt'
            ? listFunctionNames(statement, lexicalSource)
            : (readStatement(statement, NAME_READERS) ?? []);
    let offset = statement.start + (SQL_DECLARATION_PREFIX.exec(lexicalSource.slice(statement.start))?.[0].length ?? 0);
    return named
        .filter((entry) => entry.name !== '')

        .flatMap((entry): Identifier[] => {
            const found = findIdentifierOffset(entry, parsed, lexicalSource, offset);
            if (found !== -1)
                offset = found + (SQL_QUALIFIED_NAME.exec(lexicalSource.slice(found))?.[0].length ?? entry.name.length);
            if (parsed.variables.some(({ start, end }) => found >= start && found < end)) return [];
            const identifierStart = found === -1 ? statement.start : found;
            const quoteWidth = source[identifierStart] === '"' ? 1 : 0;
            return [
                createIdentifier(
                    { file, language: 'sql' },
                    {
                        ...computePosition(source, identifierStart + quoteWidth),
                        category: entry.category,
                        name: entry.name,
                    },
                ),
            ];
        });
}

/**
 * Lists the identifiers a SQL file declares, or the parse error.
 * @param file the repository path of the source.
 * @param source the SQL to parse.
 * @param reads the cache that SQL checks share.
 * @returns the identifiers, or the parse error and no identifiers.
 */
export async function extractSqlIdentifiers(file: string, source: string, reads: ReadCache): Promise<IdentifierRead> {
    const parsed = await parseSqlFile(source, reads);
    if (parsed.error !== undefined) return { identifiers: [], error: parsed.error };
    // eslint-disable-next-line unicorn/prefer-spread -- reason: SQL offsets count UTF-16 code units, including each surrogate half.
    const characters = parsed.source.split('');
    for (const token of listSqlTokens(parsed.source))
        if (token.kind === 'line-comment' || token.kind === 'block-comment')
            characters.fill(' ', token.start, token.end);
    const lexicalSource = characters.join('');
    return {
        identifiers: parsed.statements.flatMap((statement) =>
            extractStatementIdentifiers({
                file: file,
                source: source,
                statement: statement,
                parsed: parsed,
                lexicalSource: lexicalSource,
            }),
        ),
        error: undefined,
    };
}
