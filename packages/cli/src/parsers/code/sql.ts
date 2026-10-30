import { remember } from '#cli/system/cache.ts';
import { getPosition } from '#cli/system/text.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import type { TextRange } from '#cli/types/text.ts';
import { dirname, basename } from 'node:path/posix';
import type { Node, ParseResult } from '@pgsql/types';
import type { RunCache } from '#cli/types/system/cache.ts';

import type {
    SqlFile,
    SqlToken,
    BlankedSql,
    SqlStatement,
    MatchedToken,
    SqlNodeFields,
} from '#cli/types/parsers/code/sql.ts';
import {
    FROZEN_ALL,
    FROZEN_NONE,
    WORD_CHARACTER,
    IDENTIFIER_START,
    MIGRATION_VERSION,
    DOLLAR_TAG_BLOCKER,
    PRISMA_MIGRATION_FILE,
} from '#cli/config/parsers/code/sql.ts';

/**
Select migration paths at or below the written version.

@param paths the migration files to filter.
@param through the written freeze version.
*/
export function selectFrozenMigrations(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    const cutoff = MIGRATION_VERSION.exec(through)?.groups?.['version'];
    return new Set(
        paths.filter((path) => {
            const version = extractMigrationVersion(path);
            return (
                through === FROZEN_ALL ||
                (version !== undefined && cutoff !== undefined && compareMigrationVersions(version, cutoff) <= 0)
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
    const versioned = name === PRISMA_MIGRATION_FILE ? basename(dirname(path)) : name;
    return MIGRATION_VERSION.exec(versioned)?.groups?.['version']?.replaceAll('_', '.');
}

/**
Order two migration versions group by group, each group as a number.

@param left a version.
@param right another version.
@returns a negative number when left comes first, zero for equal versions, or a positive number otherwise.
*/
export function compareMigrationVersions(left: string, right: string): number {
    const first = left.replaceAll('_', '.').split('.');
    const second = right.replaceAll('_', '.').split('.');
    for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
        const before = BigInt(first[index] ?? '0');
        const after = BigInt(second[index] ?? '0');
        if (before !== after) return before < after ? -1 : 1;
    }
    return 0;
}

const PARSED_SQL_FILES = Symbol('parsed sql files');

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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The Postgres checks and the SQL parser select node fields by kind through its one cast.
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
Parse a PostgreSQL file once per run.

@param text the original SQL, including supported psql syntax.
@param cache the run cache.
*/
export function parseSqlFile(text: string, cache: RunCache): Promise<SqlFile> {
    return remember(cache, PARSED_SQL_FILES, text, async (): Promise<SqlFile> => {
        const { text: source, variables } = replacePsqlSyntax(text);
        if (source.trim() === '') return { source, variables, statements: [], error: undefined };
        const parsed = await parsePostgres(source);
        const bytes = Buffer.from(source, 'utf8');
        if ('error' in parsed) {
            const offset = [...source].slice(0, parsed.error.offset).join('').length;
            return {
                source,
                variables,
                statements: [],
                error: { text: parsed.error.text, ...getPosition(text, offset) },
            };
        }
        const statements = parsed.value.stmts ?? [];
        let byteOffset = 0;
        let offset = 0;
        const built: SqlStatement[] = [];
        for (const statement of statements.toSorted(
            (left, right) => (left.stmt_location ?? 0) - (right.stmt_location ?? 0),
        )) {
            const location = statement.stmt_location ?? 0;
            offset += bytes.subarray(byteOffset, location).toString('utf8').length;
            byteOffset = location;
            if (statement.stmt === undefined) continue;
            for (const [kind, fields] of Object.entries(statement.stmt))
                built.push({ kind, fields, start: offset } as SqlStatement);
        }
        return {
            source,
            variables,
            statements: built,
            error: undefined,
        };
    });
}

function findLineEnd(text: string, offset: number, stops: string): number {
    for (let at = offset; at < text.length; at += 1) if (stops.includes(text[at] ?? '')) return at;
    return text.length;
}

function findDoubledQuoteEnd(text: string, offset: number, quote: string): number {
    for (let at = offset; at < text.length; at += 1) {
        if (text[at] !== quote) continue;
        if (text[at + 1] === quote) at += 1;
        else return at + 1;
    }
    return text.length;
}

function findEscapedStringEnd(text: string, offset: number): number {
    for (let at = offset; at < text.length; at += 1) {
        const char = text[at];
        if (char === '\\' || (char === "'" && text[at + 1] === "'")) at += 1;
        else if (char === "'") return at + 1;
    }
    return text.length;
}

function findIdentifierEnd(text: string, offset: number): number {
    if (!IDENTIFIER_START.test(text[offset] ?? '')) return offset;
    let end = offset + 1;
    while (WORD_CHARACTER.test(text[end] ?? '')) end += 1;
    return end;
}

function findVariableEnd(text: string, offset: number): number {
    const quote = text[offset + 1];
    const isQuoted = quote === "'" || quote === '"';
    const start = offset + (isQuoted ? ":'".length : 1);
    const end = findIdentifierEnd(text, start);
    if (end === start) return -1;
    if (!isQuoted) return end;
    return text[end] === quote ? end + 1 : -1;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, the E and e entries of TOKEN_MATCHERS repeat its body.
function matchEscapedString(text: string, offset: number): MatchedToken | undefined {
    return text[offset + 1] !== "'" || WORD_CHARACTER.test(text[offset - 1] ?? '')
        ? undefined
        : { end: findEscapedStringEnd(text, offset + "E'".length), kind: 'other' };
}

function matchDollarTag(text: string, offset: number): MatchedToken | undefined {
    if (DOLLAR_TAG_BLOCKER.test(text[offset - 1] ?? '')) return undefined;
    const end = findIdentifierEnd(text, offset + 1);
    return text[end] === '$' ? { end: end + 1, kind: 'dollar' } : undefined;
}

function matchColonToken(text: string, offset: number): MatchedToken | undefined {
    if (text[offset + 1] === ':') return { end: offset + '::'.length, kind: 'other' };
    const end = findVariableEnd(text, offset);
    return end === -1 ? undefined : { end, kind: 'variable' };
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
    "'": (text, at) => ({ end: findDoubledQuoteEnd(text, at + 1, "'"), kind: 'other' }),
    '"': (text, at) => ({ end: findDoubledQuoteEnd(text, at + 1, '"'), kind: 'other' }),
    $: matchDollarTag,
    '\\': (text, at) => {
        return { end: findLineEnd(text, at, '\r\n'), kind: 'command' };
    },
    ':': matchColonToken,
};

function findBlockCommentEnd(text: string, offset: number): number {
    let depth = 1;
    for (let at = offset; at < text.length; at += 1) {
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

function findTokenEnd(text: string, offset: number, token: MatchedToken): number {
    if (token.kind === 'block-comment') return findBlockCommentEnd(text, token.end);
    if (token.kind !== 'dollar') return token.end;
    const tag = text.slice(offset, token.end);
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
