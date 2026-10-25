import { getPosition } from '#cli/system/text.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import type { TextRange } from '#cli/types/text.ts';
import { dirname, basename } from 'node:path/posix';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { Node, RawStmt, ParseResult } from '@pgsql/types';

import {
    FROZEN_ALL,
    FROZEN_NONE,
    WORD_CHARACTER,
    IDENTIFIER_START,
    MIGRATION_VERSION,
    DOLLAR_TAG_BLOCKER,
} from '#cli/config/parsers/code/sql.ts';
import type {
    SqlFile,
    SqlToken,
    BlankedSql,
    SqlStatement,
    MatchedToken,
    SqlNodeFields,
    SqlStatementVisitors,
} from '#cli/types/parsers/code/sql.ts';

/**
Select migration paths at or below the written version.

@param paths the migration files to filter.
@param through the written freeze version.
@returns the frozen paths.
*/
export function selectFrozenMigrations(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    const cutoff = MIGRATION_VERSION.exec(through)?.groups?.['version'];
    return new Set(
        paths.filter((path) => {
            const version = extractMigrationVersion(path);
            return (
                through === FROZEN_ALL ||
                (version !== undefined && cutoff !== undefined && BigInt(version) <= BigInt(cutoff))
            );
        }),
    );
}

/**
Extract a migration version from its file name or its Prisma folder.

@param path the repository-relative SQL file to inspect.
@returns the numeric version when the name starts with one.
*/
export function extractMigrationVersion(path: string): string | undefined {
    const name = basename(path);
    const versioned = name === 'migration.sql' ? basename(dirname(path)) : name;
    return MIGRATION_VERSION.exec(versioned)?.groups?.['version'];
}

const PARSED_SQL_FILES = { create: () => new Map<string, Promise<SqlFile>>() };

function buildStatements(bytes: Buffer, statement: RawStmt): SqlStatement[] {
    if (statement.stmt === undefined) return [];
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return Object.entries(statement.stmt).map(([kind, fields]) => ({ kind, fields, start }) as SqlStatement);
}

async function parseSqlText(text: string): Promise<SqlFile> {
    const { text: source, variables } = replacePsqlSyntax(text);
    if (source.trim() === '') return { source, variables, statements: [], error: undefined };
    const parsed = await parsePostgres(source);
    const bytes = Buffer.from(source, 'utf8');
    if ('error' in parsed) {
        let offset = 0;
        let remaining = Math.min(parsed.error.offset, [...source].length);
        for (const character of source) {
            if (remaining <= 0) break;
            offset += character.length;
            remaining -= 1;
        }
        return {
            source,
            variables,
            statements: [],
            error: { text: parsed.error.text, ...getPosition(text, offset) },
        };
    }
    const statements = parsed.value.stmts ?? [];
    return {
        source,
        variables,
        statements: statements.flatMap((statement) => buildStatements(bytes, statement)),
        error: undefined,
    };
}

async function parsePostgres(text: string): Promise<Parsed<ParseResult, { text: string; offset: number }>> {
    const { SqlError, parse: parseSql } = await import('libpg-query');
    try {
        return { value: await parseSql(text) };
    } catch (error) {
        if (!(error instanceof SqlError) || error.sqlDetails === undefined) throw error;
        return { error: { text: error.message, offset: error.sqlDetails.cursorPosition } };
    }
}

/**
Get the fields of a PostgreSQL parse tree node when the node has the given kind.

@param node the parse tree node, if any.
@param kind the node kind to select.
@returns the fields of that kind, or undefined for another kind.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function getNodeFields<Kind extends keyof SqlNodeFields>(
    node: Node | undefined,
    kind: Kind,
): SqlNodeFields[Kind] | undefined {
    return node === undefined || !Reflect.has(node, kind)
        ? undefined
        : (node as Record<Kind, SqlNodeFields[Kind]>)[kind];
}

/**
List the fields of the nodes of one kind in a node list.

@param nodes the nodes, if any.
@param kind the node kind to select.
@returns the fields of the matching nodes, in source order.
*/
export function listNodeFields<Kind extends keyof SqlNodeFields>(
    nodes: Node[] | undefined,
    kind: Kind,
): SqlNodeFields[Kind][] {
    return (nodes ?? []).flatMap((node) => {
        const fields = getNodeFields(node, kind);
        return fields === undefined ? [] : [fields];
    });
}

/**
Pass a parsed statement to the reader for its kind.

@param statement the parse result and source offset.
@param readers the functions for each kind.
@param readerArguments the extra values to pass on.
@returns the result, or undefined for a kind without a reader.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function visitStatement<Result, Arguments extends unknown[]>(
    statement: SqlStatement,
    readers: SqlStatementVisitors<Result, Arguments>,
    ...readerArguments: Arguments
): Result | undefined {
    const read = readers[statement.kind] as
        | ((statement: SqlStatement, ...readerArguments: Arguments) => Result)
        | undefined;
    return read?.(statement, ...readerArguments);
}

/**
Parse a PostgreSQL file once per run.

@param text the original SQL, including supported psql syntax.
@param reads the run cache.
@returns the statements and the original error positions.
*/
export function parseSqlFile(text: string, reads: ReadCache): Promise<SqlFile> {
    const files = getCachedValue(reads, PARSED_SQL_FILES);
    let parsed = files.get(text);
    if (parsed === undefined) {
        parsed = parseSqlText(text);
        files.set(text, parsed);
    }
    return parsed;
}

function findLineEnd(text: string, from: number, stops: string): number {
    for (let at = from; at < text.length; at += 1) if (stops.includes(text[at] ?? '')) return at;
    return text.length;
}

function findDoubledQuoteEnd(text: string, from: number, quote: string): number {
    for (let at = from; at < text.length; at += 1) {
        if (text[at] !== quote) continue;
        if (text[at + 1] === quote) at += 1;
        else return at + 1;
    }
    return text.length;
}

function findEscapedStringEnd(text: string, from: number): number {
    for (let at = from; at < text.length; at += 1) {
        const char = text[at];
        if (char === '\\' || (char === "'" && text[at + 1] === "'")) at += 1;
        else if (char === "'") return at + 1;
    }
    return text.length;
}

function findIdentifierEnd(text: string, from: number): number {
    if (!IDENTIFIER_START.test(text[from] ?? '')) return from;
    let end = from + 1;
    while (WORD_CHARACTER.test(text[end] ?? '')) end += 1;
    return end;
}

function findVariableEnd(text: string, at: number): number {
    const quote = text[at + 1];
    const isQuoted = quote === "'" || quote === '"';
    const start = at + (isQuoted ? ":'".length : 1);
    const end = findIdentifierEnd(text, start);
    if (end === start) return -1;
    if (!isQuoted) return end;
    return text[end] === quote ? end + 1 : -1;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function matchEscapedString(text: string, at: number): MatchedToken | undefined {
    return text[at + 1] !== "'" || WORD_CHARACTER.test(text[at - 1] ?? '')
        ? undefined
        : { end: findEscapedStringEnd(text, at + "E'".length), kind: 'other' };
}

function matchDollarTag(text: string, at: number): MatchedToken | undefined {
    if (DOLLAR_TAG_BLOCKER.test(text[at - 1] ?? '')) return undefined;
    const end = findIdentifierEnd(text, at + 1);
    return text[end] === '$' ? { end: end + 1, kind: 'dollar' } : undefined;
}

function matchColonToken(text: string, at: number): MatchedToken | undefined {
    if (text[at + 1] === ':') return { end: at + '::'.length, kind: 'other' };
    const end = findVariableEnd(text, at);
    return end === -1 ? undefined : { end, kind: 'variable' };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The SQL token table calls it for both quote characters.
function matchQuotedToken(text: string, at: number): MatchedToken {
    return { end: findDoubledQuoteEnd(text, at + 1, text[at] ?? ''), kind: 'other' };
}

const TOKEN_MATCHERS: Record<string, (text: string, at: number) => MatchedToken | undefined> = {
    '-': (text, at) => {
        return text[at + 1] === '-' ? { end: findLineEnd(text, at, '\n'), kind: 'line-comment' } : undefined;
    },
    '/': (text, at) => {
        return text[at + 1] === '*' ? { end: at + '/*'.length, kind: 'block-comment' } : undefined;
    },
    E: matchEscapedString,
    e: matchEscapedString,
    "'": matchQuotedToken,
    '"': matchQuotedToken,
    $: matchDollarTag,
    '\\': (text, at) => {
        return { end: findLineEnd(text, at, '\r\n'), kind: 'command' };
    },
    ':': matchColonToken,
};

function findBlockCommentEnd(text: string, from: number): number {
    let depth = 1;
    for (let at = from; at < text.length; at += 1) {
        const pair = text.slice(at, at + '/*'.length);
        if (pair === '/*') {
            depth += 1;
            at += 1;
        } else if (pair === '*/') {
            depth -= 1;
            at += 1;
            if (depth === 0) return at + 1;
        }
    }
    return text.length;
}

function findTokenEnd(text: string, at: number, token: MatchedToken): number {
    if (token.kind === 'block-comment') return findBlockCommentEnd(text, token.end);
    if (token.kind !== 'dollar') return token.end;
    const tag = text.slice(at, token.end);
    const close = text.indexOf(tag, token.end);
    return close === -1 ? text.length : close + tag.length;
}

function buildReplacement(kind: SqlToken['kind'], text: string): string {
    if (kind === 'command') return ' '.repeat(text.length);
    if (text[1] === "'") return `''${' '.repeat(text.length - "''".length)}`;
    return text[1] === '"' ? ` ${text.slice(1)}` : `_${text.slice(1)}`;
}

/**
Read SQL strings, comments, and client syntax without interpreting quoted bodies as source.

@param text the SQL source.
@returns tokens with their original UTF-16 boundaries.
*/
export function* listSqlTokens(text: string): Generator<SqlToken> {
    let at = 0;
    while (at < text.length) {
        const matched = TOKEN_MATCHERS[text[at] ?? '']?.(text, at);
        if (matched === undefined) {
            at += 1;
            continue;
        }
        const end = findTokenEnd(text, at, matched);
        yield { start: at, end, kind: matched.kind };
        at = end;
    }
}

function replacePsqlSyntax(text: string): BlankedSql {
    const variables: TextRange[] = [];
    const pieces: string[] = [];
    let offset = 0;
    for (const { start, end, kind } of listSqlTokens(text)) {
        if (!(kind === 'command' || kind === 'variable')) {
            continue;
        }

        pieces.push(text.slice(offset, start), buildReplacement(kind, text.slice(start, end)));
        if (kind === 'variable') variables.push({ start, end });
        offset = end;
    }
    pieces.push(text.slice(offset));
    return { text: pieces.join(''), variables };
}
