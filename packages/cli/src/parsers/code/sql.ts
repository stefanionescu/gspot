import type { Node, ParseResult } from '@pgsql/types';

import { DOLLAR_TAG_BLOCKER, IDENTIFIER_START, WORD_CHARACTER } from '#cli/config/parsers.ts';
import { remember } from '#cli/system/cache.ts';
import { getPosition } from '#cli/system/text.ts';
import type {
    BlankedSql,
    MatchedToken,
    Parsed,
    SqlFile,
    SqlNodeFields,
    SqlStatement,
    SqlToken,
} from '#cli/types/parsers.ts';
import type { RunCache, TextRange } from '#cli/types/system.ts';

async function parsePostgres(text: string): Promise<Parsed<ParseResult, { text: string; offset: number }>> {
    const { SqlError, parse: parseSql } = await import('libpg-query');
    try {
        return { value: await parseSql(text) };
    } catch (error) {
        if (!(error instanceof SqlError) || error.sqlDetails === undefined) throw error;
        return { error: { text: error.message, offset: error.sqlDetails.cursorPosition } };
    }
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

function listSqlStatements(source: string, statements: NonNullable<ParseResult['stmts']>): SqlStatement[] {
    const bytes = Buffer.from(source, 'utf8');
    const sorted = statements.toSorted((left, right) => (left.stmt_location ?? 0) - (right.stmt_location ?? 0));
    let byteOffset = 0;
    let offset = 0;
    const built: SqlStatement[] = [];
    for (const statement of sorted) {
        const location = statement.stmt_location ?? 0;
        offset += bytes.subarray(byteOffset, location).toString('utf8').length;
        byteOffset = location;
        if (statement.stmt === undefined) continue;
        const start = offset;
        const nodes = Object.entries(statement.stmt).map(([kind, fields]) => ({ kind, fields, start }));
        built.push(...(nodes as SqlStatement[]));
    }
    return built;
}

const PARSED_SQL_FILES = Symbol('parsed sql files');

export function findNodeFields<Kind extends keyof SqlNodeFields>(
    node: Node | undefined,
    kind: Kind,
): SqlNodeFields[Kind] | undefined {
    return node === undefined || !Reflect.has(node, kind)
        ? undefined
        : (node as Record<Kind, SqlNodeFields[Kind]>)[kind];
}

export function listNodeFields<Kind extends keyof SqlNodeFields>(
    nodes: Node[] | undefined,
    kind: Kind,
): Array<SqlNodeFields[Kind]> {
    return (nodes ?? []).flatMap((node) => {
        const fields = findNodeFields(node, kind);
        return fields === undefined ? [] : [fields];
    });
}

export function parseSqlFile(text: string, cache: RunCache): Promise<SqlFile> {
    return remember(cache, PARSED_SQL_FILES, text, async (): Promise<SqlFile> => {
        const { text: source, variables } = replacePsqlSyntax(text);
        if (source.trim() === '') return { source, variables, statements: [], error: undefined };
        const parsed = await parsePostgres(source);
        if ('error' in parsed) {
            const offset = [...source].slice(0, parsed.error.offset).join('').length;
            return {
                source,
                variables,
                statements: [],
                error: { text: parsed.error.text, ...getPosition(text, offset) },
            };
        }
        return {
            source,
            variables,
            statements: listSqlStatements(source, parsed.value.stmts ?? []),
            error: undefined,
        };
    });
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

/**
Read SQL strings, comments, and client syntax without interpreting quoted bodies as source.
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
