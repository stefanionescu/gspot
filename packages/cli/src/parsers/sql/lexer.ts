// Tokenize PostgreSQL literals and mask psql client syntax without shifting source positions.
// Scans SQL tokens while preserving their source positions.
import type { SqlRange, SqlToken, PreparedSql } from '#cli/types/parsers/sql.ts';
import { WORD_CHARACTER, IDENTIFIER_START, DOLLAR_TAG_BLOCKER } from '#cli/config/parsers/sql.ts';

// The index of the first stop character at or after from, or the text length.
function findLineEnd(text: string, from: number, stops: string): number {
    for (let at = from; at < text.length; at += 1) if (stops.includes(text[at] ?? '')) return at;
    return text.length;
}

// An unclosed quoted value owns the rest of the source, so its contents remain literal.
function findDoubledQuoteEnd(text: string, from: number, quote: string): number {
    for (let at = from; at < text.length; at += 1) {
        if (text[at] !== quote) continue;
        if (text[at + 1] === quote) at += 1;
        else return at + 1;
    }
    return text.length;
}

// The index past an E'' string, whose backslash escapes the next character, or the text length when unclosed.
function findEscapedStringEnd(text: string, from: number): number {
    for (let at = from; at < text.length; at += 1) {
        const char = text[at];
        if (char === '\\') at += 1;
        else if (char === "'" && text[at + 1] === "'") at += 1;
        else if (char === "'") return at + 1;
    }
    return text.length;
}

// The index past an identifier that starts at from, or from when none starts there.
function findIdentifierEnd(text: string, from: number): number {
    if (!IDENTIFIER_START.test(text[from] ?? '')) return from;
    let end = from + 1;
    while (WORD_CHARACTER.test(text[end] ?? '')) end += 1;
    return end;
}

// The index past a psql variable such as `:name`, `:'name'`, or `:"name"`, or `-1` when the colon starts none.
function findVariableEnd(text: string, at: number): number {
    const quote = text[at + 1];
    const isQuoted = quote === "'" || quote === '"';
    const start = isQuoted ? at + ":'".length : at + 1;
    const end = findIdentifierEnd(text, start);
    if (end === start) return -1;
    if (!isQuoted) return end;
    return text[end] === quote ? end + 1 : -1;
}

// An E'' string, whose E must start a word.
function matchEscapedString(text: string, at: number): Omit<SqlToken, 'start'> | undefined {
    if (text[at + 1] !== "'" || WORD_CHARACTER.test(text[at - 1] ?? '')) return undefined;
    return { end: findEscapedStringEnd(text, at + "E'".length), kind: 'other' };
}

// A dollar-quote tag, which cannot continue an identifier or a number.
function matchDollarTag(text: string, at: number): Omit<SqlToken, 'start'> | undefined {
    if (DOLLAR_TAG_BLOCKER.test(text[at - 1] ?? '')) return undefined;
    const end = findIdentifierEnd(text, at + 1);
    return text[end] === '$' ? { end: end + 1, kind: 'dollar' } : undefined;
}

// A cast operator, or a psql variable.
function matchColonToken(text: string, at: number): Omit<SqlToken, 'start'> | undefined {
    if (text[at + 1] === ':') return { end: at + '::'.length, kind: 'other' };
    const end = findVariableEnd(text, at);
    return end === -1 ? undefined : { end, kind: 'variable' };
}

// The reader for each character that can start a lexeme.
function quotedAt(text: string, at: number): Omit<SqlToken, 'start'> {
    return { end: findDoubledQuoteEnd(text, at + 1, text[at] ?? ''), kind: 'other' };
}

const READERS: Record<string, (text: string, at: number) => Omit<SqlToken, 'start'> | undefined> = {
    '-': (text: string, at: number): Omit<SqlToken, 'start'> | undefined => {
        return text[at + 1] === '-' ? { end: findLineEnd(text, at, '\n'), kind: 'line-comment' } : undefined;
    },
    '/': (text: string, at: number): Omit<SqlToken, 'start'> | undefined => {
        return text[at + 1] === '*' ? { end: at + '/*'.length, kind: 'block-comment' } : undefined;
    },
    E: matchEscapedString,
    e: matchEscapedString,
    "'": quotedAt,
    '"': quotedAt,
    $: matchDollarTag,
    '\\': (text: string, at: number): Omit<SqlToken, 'start'> => {
        return { end: findLineEnd(text, at, '\r\n'), kind: 'command' };
    },
    ':': matchColonToken,
};

// The index past the block comment whose opener ends at from, with nesting, or the text length when unclosed.
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

// The index past the whole lexeme: a block comment closes with nesting, and a dollar quote at its tag's return.
function findLexemeEnd(text: string, at: number, lexeme: Omit<SqlToken, 'start'>): number {
    if (lexeme.kind === 'block-comment') return findBlockCommentEnd(text, lexeme.end);
    if (lexeme.kind !== 'dollar') return lexeme.end;
    const tag = text.slice(at, lexeme.end);
    const close = text.indexOf(tag, lexeme.end);
    return close === -1 ? text.length : close + tag.length;
}

// The parser text that stands in for a meta-command or a psql variable, with the same length so positions hold.
function buildReplacement(kind: Omit<SqlToken, 'start'>['kind'], lexeme: string): string {
    if (kind === 'command') return ' '.repeat(lexeme.length);
    if (lexeme[1] === "'") return `''${' '.repeat(lexeme.length - "''".length)}`;
    if (lexeme[1] === '"') return ` ${lexeme.slice(1)}`;
    return `_${lexeme.slice(1)}`;
}

/**
 * Read SQL strings, comments, and client syntax without interpreting quoted bodies as source.
 * @param text the SQL source.
 * @returns tokens with their original UTF-16 boundaries.
 */
export function* listSqlTokens(text: string): Generator<SqlToken> {
    let at = 0;
    while (at < text.length) {
        const lexeme = READERS[text[at] ?? '']?.(text, at);
        if (lexeme === undefined) {
            at += 1;
            continue;
        }
        const end = findLexemeEnd(text, at, lexeme);
        yield { start: at, end, kind: lexeme.kind };
        at = end;
    }
}

/**
 * Prepare client-side psql syntax without changing SQL lexeme positions or quoted bodies.
 * @param text the SQL source with client commands and substitutions.
 * @returns parser text and substitution ranges in original UTF-16 coordinates.
 */
export function replacePsqlSyntax(text: string): PreparedSql {
    const variables: SqlRange[] = [];
    const pieces: string[] = [];
    let offset = 0;
    for (const { start, end, kind } of listSqlTokens(text)) {
        if (kind === 'command' || kind === 'variable') {
            pieces.push(text.slice(offset, start), buildReplacement(kind, text.slice(start, end)));
            if (kind === 'variable') variables.push({ start, end });
            offset = end;
        }
    }
    pieces.push(text.slice(offset));
    return { text: pieces.join(''), variables };
}
