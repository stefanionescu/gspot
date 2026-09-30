// The index of the first stop character at or after from, or the text length.
import type { Token, SqlToken } from '#cli/types/parsers/sql.ts';

// Two characters read together: a doubled quote or a two-character operator.
const PAIR = 2;

function lineEnd(text: string, from: number, stops: string): number {
    for (let at = from; at < text.length; at += 1) if (stops.includes(text[at] ?? '')) return at;
    return text.length;
}

// An unclosed quoted value owns the rest of the source, so its contents remain literal.
function doubledQuoteEnd(text: string, from: number, quote: string): number {
    for (let at = from; at < text.length; at += 1) {
        if (text[at] !== quote) continue;
        if (text[at + 1] === quote) at += 1;
        else return at + 1;
    }
    return text.length;
}

// The index past an E'' string, whose backslash escapes the next character, or the text length when unclosed.
function escapedStringEnd(text: string, from: number): number {
    for (let at = from; at < text.length; at += 1) {
        const char = text[at];
        if (char === '\\') at += 1;
        else if (char === "'" && text[at + 1] === "'") at += 1;
        else if (char === "'") return at + 1;
    }
    return text.length;
}

// The index past an identifier that starts at from, or from when none starts there.
function identifierEnd(text: string, from: number): number {
    if (!/[A-Za-z_]/u.test(text[from] ?? '')) return from;
    let end = from + 1;
    while (/\w/u.test(text[end] ?? '')) end += 1;
    return end;
}

// The index past a psql variable such as `:name`, `:'name'`, or `:"name"`, or `-1` when the colon starts none.
function variableEnd(text: string, at: number): number {
    const quote = text[at + 1];
    const isQuoted = quote === "'" || quote === '"';
    const start = isQuoted ? at + "E'".length : at + 1;
    const end = identifierEnd(text, start);
    if (end === start) return -1;
    if (!isQuoted) return end;
    return text[end] === quote ? end + 1 : -1;
} // An E'' string, whose E must start a word.

function escapedStringAt(text: string, at: number): Token | undefined {
    if (text[at + 1] !== "'" || /\w/u.test(text[at - 1] ?? '')) return undefined;
    return { end: escapedStringEnd(text, at + "E'".length), kind: 'other' };
}

// A dollar-quote tag, which cannot continue an identifier or a number.
function dollarAt(text: string, at: number): Token | undefined {
    if (/[\p{L}\p{N}_$]/u.test(text[at - 1] ?? '')) return undefined;
    const end = identifierEnd(text, at + 1);
    return text[end] === '$' ? { end: end + 1, kind: 'dollar' } : undefined;
}

// A cast operator, or a psql variable.
function colonAt(text: string, at: number): Token | undefined {
    if (text[at + 1] === ':') return { end: at + '::'.length, kind: 'other' };
    const end = variableEnd(text, at);
    return end === -1 ? undefined : { end, kind: 'variable' };
}

// The reader for each character that can start a lexeme.
const READERS: Record<string, (text: string, at: number) => Token | undefined> = {
    '-': (text: string, at: number): Token | undefined => {
        return text[at + 1] === '-' ? { end: lineEnd(text, at, '\n'), kind: 'line-comment' } : undefined;
    },
    '/': (text: string, at: number): Token | undefined => {
        return text[at + 1] === '*' ? { end: at + '/*'.length, kind: 'block-comment' } : undefined;
    },
    E: escapedStringAt,
    e: escapedStringAt,
    "'": (text: string, at: number): Token => {
        return { end: doubledQuoteEnd(text, at + 1, text[at] ?? ''), kind: 'other' };
    },
    '"': (text: string, at: number): Token => {
        return { end: doubledQuoteEnd(text, at + 1, text[at] ?? ''), kind: 'other' };
    },
    $: dollarAt,
    '\\': (text: string, at: number): Token => {
        return { end: lineEnd(text, at, '\r\n'), kind: 'command' };
    },
    ':': colonAt,
};

// The index past the block comment whose opener ends at from, with nesting, or the text length when unclosed.
function blockCommentEnd(text: string, from: number): number {
    let depth = 1;
    for (let at = from; at < text.length; at += 1) {
        const pair = text.slice(at, at + PAIR);
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
function lexemeSpanEnd(text: string, at: number, lexeme: Token): number {
    if (lexeme.kind === 'block-comment') return blockCommentEnd(text, lexeme.end);
    if (lexeme.kind !== 'dollar') return lexeme.end;
    const tag = text.slice(at, lexeme.end);
    const close = text.indexOf(tag, lexeme.end);
    return close === -1 ? text.length : close + tag.length;
}

// The parser text that stands in for a meta-command or a psql variable, with the same length so positions hold.
function replacement(kind: Token['kind'], lexeme: string): string {
    if (kind === 'command') return ' '.repeat(lexeme.length);
    if (lexeme[1] === "'") return `''${' '.repeat(lexeme.length - "''".length)}`;
    if (lexeme[1] === '"') return ` ${lexeme.slice(1)}`;
    return `_${lexeme.slice(1)}`;
}

/**
 * Read SQL strings, comments, and client syntax without interpreting quoted bodies as source.
 * @param text the authored SQL
 * @returns tokens with their original UTF-16 boundaries
 */
export function* sqlTokens(text: string): Generator<SqlToken> {
    let at = 0;
    while (at < text.length) {
        const lexeme = READERS[text[at] ?? '']?.(text, at);
        if (lexeme === undefined) {
            at += 1;
            continue;
        }
        const end = lexemeSpanEnd(text, at, lexeme);
        yield { start: at, end, kind: lexeme.kind };
        at = end;
    }
}

/**
 * Prepare client-side psql syntax without changing SQL lexeme positions or quoted bodies.
 * @param text the authored SQL with client commands and substitutions
 * @returns parser text and substitution ranges in original UTF-16 coordinates
 */
export function sqlSource(text: string): { text: string; variables: { start: number; end: number }[] } {
    const variables: { start: number; end: number }[] = [];
    const pieces: string[] = [];
    let offset = 0;
    for (const { start, end, kind } of sqlTokens(text)) {
        if (kind === 'command' || kind === 'variable') {
            pieces.push(text.slice(offset, start), replacement(kind, text.slice(start, end)));
            if (kind === 'variable') variables.push({ start, end });
            offset = end;
        }
    }
    pieces.push(text.slice(offset));
    return { text: pieces.join(''), variables };
}
