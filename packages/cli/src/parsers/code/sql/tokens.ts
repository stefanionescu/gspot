import type { SqlRange, SqlToken, BlankedSql } from '#cli/types/parsers/code/sql.ts';
import { WORD_CHARACTER, IDENTIFIER_START, DOLLAR_TAG_BLOCKER } from '#cli/config/parsers/code/sql/tokens.ts';

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

type MatchedToken = Omit<SqlToken, 'start'>;

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

/**
Prepare client-side psql syntax without changing SQL token positions or quoted bodies.

@param text the SQL source with client commands and substitutions.
@returns parser text and substitution ranges in original UTF-16 coordinates.
*/
export function replacePsqlSyntax(text: string): BlankedSql {
    const variables: SqlRange[] = [];
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
