// Keep psql substitutions outside SQL strings and comments while preserving character positions.
type Lexeme = { end: number; kind: 'comment' | 'dollar' | 'command' | 'variable' | 'other' };

// The index of the first stop character at or after from, or the text length.
function lineEnd(text: string, from: number, stops: string): number {
    for (let at = from; at < text.length; at += 1) if (stops.includes(text[at] ?? '')) return at;
    return text.length;
}

// The index past a quoted lexeme whose quote doubles to escape itself, or -1 when it never closes.
function doubledQuoteEnd(text: string, from: number, quote: string): number {
    for (let at = from; at < text.length; at += 1) {
        if (text[at] !== quote) continue;
        if (text[at + 1] === quote) at += 1;
        else return at + 1;
    }
    return -1;
}

// The index past an E'' string, whose backslash escapes the next character, or -1 when it never closes.
function escapedStringEnd(text: string, from: number): number {
    for (let at = from; at < text.length; at += 1) {
        const char = text[at];
        if (char === '\\') at += 1;
        else if (char === "'" && text[at + 1] === "'") at += 1;
        else if (char === "'") return at + 1;
    }
    return -1;
}

// The index past an identifier that starts at from, or from when none starts there.
function identifierEnd(text: string, from: number): number {
    if (!/[A-Za-z_]/u.test(text[from] ?? '')) return from;
    let end = from + 1;
    while (/\w/u.test(text[end] ?? '')) end += 1;
    return end;
}

// The index past a dollar-quote tag such as $$ or $body$, or -1 when the dollar opens no tag.
function dollarTagEnd(text: string, at: number): number {
    const end = identifierEnd(text, at + 1);
    return text[end] === '$' ? end + 1 : -1;
}

// The index past a psql variable such as :name, :'name', or :"name", or -1 when the colon starts none.
function variableEnd(text: string, at: number): number {
    const quote = text[at + 1];
    const isQuoted = quote === "'" || quote === '"';
    const start = isQuoted ? at + 2 : at + 1;
    const end = identifierEnd(text, start);
    if (end === start) return -1;
    if (!isQuoted) return end;
    return text[end] === quote ? end + 1 : -1;
}

// A line comment: two dashes to the end of the line.
function lineCommentAt(text: string, at: number): Lexeme | undefined {
    return text[at + 1] === '-' ? { end: lineEnd(text, at, '\n'), kind: 'other' } : undefined;
}

// The opener of a block comment; its end is found with nesting once the lexeme is known.
function blockCommentAt(text: string, at: number): Lexeme | undefined {
    return text[at + 1] === '*' ? { end: at + 2, kind: 'comment' } : undefined;
}

// An E'' string, whose E must start a word.
function escapedStringAt(text: string, at: number): Lexeme | undefined {
    if (text[at + 1] !== "'" || /\w/u.test(text[at - 1] ?? '')) return undefined;
    const end = escapedStringEnd(text, at + 2);
    return end === -1 ? undefined : { end, kind: 'other' };
}

// A string or a quoted identifier, whose quote doubles to escape itself.
function quotedAt(text: string, at: number): Lexeme | undefined {
    const end = doubledQuoteEnd(text, at + 1, text[at] ?? '');
    return end === -1 ? undefined : { end, kind: 'other' };
}

// A dollar-quote tag, which cannot continue an identifier or a number.
function dollarAt(text: string, at: number): Lexeme | undefined {
    if (/[\p{L}\p{N}_$]/u.test(text[at - 1] ?? '')) return undefined;
    const end = dollarTagEnd(text, at);
    return end === -1 ? undefined : { end, kind: 'dollar' };
}

// A psql meta-command: a backslash to the end of the line.
function commandAt(text: string, at: number): Lexeme {
    return { end: lineEnd(text, at, '\r\n'), kind: 'command' };
}

// A cast operator, or a psql variable.
function colonAt(text: string, at: number): Lexeme | undefined {
    if (text[at + 1] === ':') return { end: at + 2, kind: 'other' };
    const end = variableEnd(text, at);
    return end === -1 ? undefined : { end, kind: 'variable' };
}

// The reader for each character that can start a lexeme.
const READERS: Record<string, (text: string, at: number) => Lexeme | undefined> = {
    '-': lineCommentAt,
    '/': blockCommentAt,
    E: escapedStringAt,
    e: escapedStringAt,
    "'": quotedAt,
    '"': quotedAt,
    $: dollarAt,
    '\\': commandAt,
    ':': colonAt,
};

// The lexeme that starts exactly at at, or undefined when the character belongs to plain SQL.
function lexemeAt(text: string, at: number): Lexeme | undefined {
    return READERS[text[at] ?? '']?.(text, at);
}

// The index past the block comment whose opener ends at from, with nesting, or the text length when unclosed.
function blockCommentEnd(text: string, from: number): number {
    let depth = 1;
    for (let at = from; at < text.length; at += 1) {
        const pair = text.slice(at, at + 2);
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
function lexemeSpanEnd(text: string, at: number, lexeme: Lexeme): number {
    if (lexeme.kind === 'comment') return blockCommentEnd(text, lexeme.end);
    if (lexeme.kind !== 'dollar') return lexeme.end;
    const tag = text.slice(at, lexeme.end);
    const close = text.indexOf(tag, lexeme.end);
    return close === -1 ? text.length : close + tag.length;
}

// The parser text that stands in for a meta-command or a psql variable, with the same length so positions hold.
function replacement(kind: Lexeme['kind'], lexeme: string): string {
    if (kind === 'command') return ' '.repeat(lexeme.length);
    if (lexeme[1] === "'") return `''${' '.repeat(lexeme.length - 2)}`;
    if (lexeme[1] === '"') return ` ${lexeme.slice(1)}`;
    return `_${lexeme.slice(1)}`;
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
    let at = 0;
    while (at < text.length) {
        const lexeme = lexemeAt(text, at);
        if (lexeme === undefined) {
            at += 1;
            continue;
        }
        const end = lexemeSpanEnd(text, at, lexeme);
        if (lexeme.kind === 'command' || lexeme.kind === 'variable') {
            pieces.push(text.slice(offset, at), replacement(lexeme.kind, text.slice(at, end)));
            if (lexeme.kind === 'variable') variables.push({ start: at, end });
            offset = end;
        }
        at = end;
    }
    pieces.push(text.slice(offset));
    return { text: pieces.join(''), variables };
}
