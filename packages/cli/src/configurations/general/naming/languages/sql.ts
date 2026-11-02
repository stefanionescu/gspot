import type { Node } from '@pgsql/types';
import { getPosition } from '#cli/system/text.ts';
import type { RunCache } from '#cli/types/system.ts';
import type { SqlFile, SqlStatement } from '#cli/types/parsers.ts';
import { parseSqlFile, listSqlTokens, listNodeFields } from '#cli/parsers/code/sql.ts';
import type { SqlStatementVisitors } from '#cli/types/configurations/infrastructure.ts';
import type { SqlName, Identifier, IdentifierRead } from '#cli/types/configurations/general.ts';

import {
    NAME_TOKEN,
    CREATE_KIND,
    DOTTED_NAME,
    LEADING_NAME,
    CREATE_PREFIX,
    CATEGORY_LABELS,
    CREATE_MODIFIER,
    PARAMETER_DEPTH,
    PARAMETER_PREFIX,
    TABLE_PARAMETERS,
} from '#cli/config/configurations/naming.ts';

function listColumnNames(nodes: Node[] | undefined): SqlName[] {
    const columns = listNodeFields(nodes, 'ColumnDef');
    return columns.map((column) => ({
        category: 'columns',
        name: column.colname ?? '',
        ...(column.location !== undefined && { location: column.location }),
    }));
}

function listAddedColumns({ fields }: SqlStatement<'AlterTableStmt'>): SqlName[] {
    return listNodeFields(fields.cmds, 'AlterTableCmd')
        .filter((command) => command.subtype === 'AT_AddColumn')
        .flatMap((command) => listColumnNames(command.def === undefined ? [] : [command.def]));
}

const NAME_EXTRACTORS: SqlStatementVisitors<SqlName[]> = {
    CreateSchemaStmt: ({ fields }) => [{ category: 'schemas', name: fields.schemaname ?? '' }],
    CreateStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.relation?.relname ?? '',
            ...(fields.relation?.location !== undefined && { location: fields.relation.location }),
        },
        ...listColumnNames(fields.tableElts),
    ],
    ViewStmt: ({ fields }) => [
        {
            category: 'tables',
            name: fields.view?.relname ?? '',
            ...(fields.view?.location !== undefined && { location: fields.view.location }),
        },
    ],
    AlterTableStmt: listAddedColumns,
    IndexStmt: ({ fields }) => [{ category: 'indexes', name: fields.idxname ?? '' }],
    CreateTrigStmt: ({ fields }) => [{ category: 'triggers', name: fields.trigname ?? '' }],
    CreatePolicyStmt: ({ fields }) => [{ category: 'policies', name: fields.policy_name ?? '' }],
};

function scanParameterList(source: string, start: number): { spans: number[]; span: number; end: number } {
    const spans: number[] = [];
    const tokens = new Map(
        [...listSqlTokens(source.slice(start))].map((token) => [token.start + start, token.end + start]),
    );
    let span = start;
    let depth = 0;
    let at = start;
    while (at < source.length) {
        const next = tokens.get(at) ?? at + 1;
        const character = source.slice(at, next);
        depth += PARAMETER_DEPTH.get(character) ?? 0;
        if (depth < 0) break;
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

function skipCreateWords(source: string, start: number): number {
    let offset = start;
    for (const pattern of [CREATE_PREFIX, CREATE_MODIFIER, CREATE_KIND])
        offset += pattern.exec(source.slice(offset))?.[0].length ?? 0;
    return offset;
}

function matchQualifiedName(text: string): string | undefined {
    const first = LEADING_NAME.exec(text);
    if (first === null) return undefined;
    let length = first[0].length;
    let dotted = DOTTED_NAME.exec(text.slice(length));
    while (dotted !== null) {
        length += dotted[0].length;
        dotted = DOTTED_NAME.exec(text.slice(length));
    }
    return text.slice(0, length);
}

function findLastNameOffset(source: string, start: number): number {
    const qualified = matchQualifiedName(source.slice(start)) ?? '';
    const lastToken = qualified.matchAll(NAME_TOKEN).toArray().at(-1);
    return start + (lastToken?.index ?? 0);
}

function findFunctionName(statement: SqlStatement<'CreateFunctionStmt'>, source: string) {
    let start = skipCreateWords(source, statement.start);
    start += source.slice(start).length - source.slice(start).trimStart().length;
    const qualified = matchQualifiedName(source.slice(start)) ?? '';
    return { start, qualified, offset: findLastNameOffset(source, start) };
}

function listFunctionNames(statement: SqlStatement<'CreateFunctionStmt'>, source: string): SqlName[] {
    const { start, qualified, offset } = findFunctionName(statement, source);
    const names: SqlName[] = [
        {
            category: 'functions',
            name:
                listNodeFields(statement.fields.funcname, 'String')
                    .map((stringNode) => stringNode.sval ?? '')
                    .at(-1) ?? '',
            offset,
        },
    ];
    const open = source.indexOf('(', start + qualified.length);
    const input = parseParameterSpans(source, open + 1);
    const output = TABLE_PARAMETERS.exec(source.slice(input.end));
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
            offset: span + (PARAMETER_PREFIX.exec(source.slice(span))?.[0].length ?? 0),
        });
    }
    return names;
}

function findNamedToken(source: string, name: string, offset: number): number {
    const token = source
        .slice(offset)
        .matchAll(NAME_TOKEN)
        .find((match) => {
            const text = match[0];
            return (text.startsWith('"') ? text.slice(1, -1).replaceAll('""', '"') : text.toLowerCase()) === name;
        });
    return token === undefined ? -1 : offset + token.index;
}

function findIdentifierOffset(named: SqlName, parsed: SqlFile, source: string, offset: number): number {
    if (named.offset !== undefined) return named.offset;
    if (named.location === undefined || named.location < 0) return findNamedToken(source, named.name, offset);
    let found = Buffer.from(parsed.source).subarray(0, named.location).toString('utf8').length;
    if (named.category === 'tables') found = findLastNameOffset(source, found);
    return found;
}

function buildSqlIdentifier(sqlName: SqlName, location: { file: string; source: string; start: number }): Identifier {
    const { file, source, start } = location;
    const quoteWidth = source[start] === '"' ? 1 : 0;
    return {
        file,
        language: 'sql',
        label: `sql ${CATEGORY_LABELS[sqlName.category]}`,
        ...getPosition(source, start + quoteWidth),
        category: sqlName.category,
        name: sqlName.name,
    };
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
    statement: SqlStatement;
    parsed: SqlFile;
    lexicalSource: string;
}): Identifier[] {
    const read = NAME_EXTRACTORS[statement.kind] as ((statement: SqlStatement) => SqlName[]) | undefined;
    const named =
        statement.kind === 'CreateFunctionStmt'
            ? listFunctionNames(statement, lexicalSource)
            : (read?.(statement) ?? []);
    let offset = skipCreateWords(lexicalSource, statement.start);
    return named
        .filter((sqlName) => sqlName.name !== '')
        .flatMap((sqlName): Identifier[] => {
            const found = findIdentifierOffset(sqlName, parsed, lexicalSource, offset);
            if (found !== -1)
                offset = found + (matchQualifiedName(lexicalSource.slice(found))?.length ?? sqlName.name.length);
            if (parsed.variables.some(({ start, end }) => found >= start && found < end)) return [];
            return [buildSqlIdentifier(sqlName, { file, source, start: found === -1 ? statement.start : found })];
        });
}

/**
Lists the identifiers a SQL file declares, or the parse error.

@param file the repository path of the source.
@param source the SQL to parse.
@param cache the cache that SQL checks share.
*/
export async function extractSqlIdentifiers(file: string, source: string, cache: RunCache): Promise<IdentifierRead> {
    const parsed = await parseSqlFile(source, cache);
    if (parsed.error !== undefined) return { identifiers: [], error: parsed.error };
    let lexicalSource = parsed.source;
    for (const token of listSqlTokens(parsed.source))
        if (token.kind === 'line-comment' || token.kind === 'block-comment')
            lexicalSource = `${lexicalSource.slice(0, token.start)}${' '.repeat(token.end - token.start)}${lexicalSource.slice(token.end)}`;
    return {
        identifiers: parsed.statements.flatMap((statement) =>
            extractStatementIdentifiers({
                file,
                source,
                statement,
                parsed,
                lexicalSource,
            }),
        ),
        error: undefined,
    };
}
