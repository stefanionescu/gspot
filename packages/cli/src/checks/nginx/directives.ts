import type { DirectiveScan } from '#cli/types/checks/nginx.ts';
import { NGINX_ESCAPES, NGINX_PUNCTUATION, WORD_START_STOPS, WORD_STOPS } from '#cli/constants/checks/nginx.ts';

// The index just past a quoted argument that opens at start, or -1 when the quote never closes.
function quotedEnd(text: string, start: number, quote: string): number {
    for (let at = start + 1; at < text.length; at += 1) {
        if (text[at] === '\\') at += 1;
        else if (text[at] === quote) return at;
    }
    return -1;
}

// The index past an escape pair or a braced variable that starts at at, or -1 when neither starts there.
function escapeOrVariableEnd(text: string, at: number): number {
    const char = text[at];
    if (char === '\\') return at + 1 < text.length ? at + 2 : -1;
    if (char !== '$' || text[at + 1] !== '{') return -1;
    const close = text.indexOf('}', at + 2);
    return close === -1 ? -1 : close + 1;
}

// The index past one unit of a bare word: an escape pair, a braced variable, or one plain character.
function unitEnd(text: string, at: number, isFirst: boolean): number {
    const special = escapeOrVariableEnd(text, at);
    if (special !== -1) return special;
    const stops = isFirst ? WORD_START_STOPS : WORD_STOPS;
    return stops.test(text[at] ?? '') ? at : at + 1;
}

// The index past the bare word that starts at at, or at itself when no word starts there.
function wordEnd(text: string, at: number): number {
    let end = unitEnd(text, at, true);
    if (end === at) return at;
    while (end < text.length) {
        const next = unitEnd(text, end, false);
        if (next === end) break;
        end = next;
    }
    return end;
}

// A comment: the hash to the end of the line.
function commentAt(text: string, at: number): DirectiveScan {
    const end = text.indexOf('\n', at);
    const stop = end === -1 ? text.length : end;
    return { token: text.slice(at, stop), end: stop };
}

// A quoted argument, or the skipped quote when it never closes.
function quotedAt(text: string, at: number): DirectiveScan {
    const end = quotedEnd(text, at, text[at] ?? '');
    return end === -1 ? { token: undefined, end: at + 1 } : { token: text.slice(at, end + 1), end: end + 1 };
}

// A bare word, or the skipped character when none starts here.
function wordAt(text: string, at: number): DirectiveScan {
    const end = wordEnd(text, at);
    return end === at ? { token: undefined, end: at + 1 } : { token: text.slice(at, end), end };
}

// The comment, punctuation, quoted argument, or bare word at at; a character that starts none is skipped.
function scanAt(text: string, at: number): DirectiveScan {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return { token: undefined, end: at + 1 };
    if (char === '#') return commentAt(text, at);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: at + 1 };
    if (char === '"' || char === "'") return quotedAt(text, at);
    return wordAt(text, at);
}

// The tokens of an nginx configuration: comments, punctuation, quoted arguments, and bare words.
function nginxTokens(text: string): string[] {
    const tokens: string[] = [];
    let at = 0;
    while (at < text.length) {
        const scan = scanAt(text, at);
        if (scan.token !== undefined) tokens.push(scan.token);
        at = scan.end;
    }
    return tokens;
}

// The argument a token carries: its quotes removed and its escapes resolved.
function argumentValue(token: string): string {
    const value = token.replace(/^(["'])([\s\S]*)\1$/u, '$2');
    return value.replaceAll(/\\([trn"'\\])/gu, (_, escaped: string) => NGINX_ESCAPES[escaped] ?? escaped);
}

/**
 * Read directive arguments without changing quoted whitespace or treating comments as configuration.
 * @param text the nginx configuration text
 * @returns each directive as its name followed by its arguments
 */
export function nginxDirectives(text: string): string[][] {
    const directives: string[][] = [];
    let directive: string[] = [];
    for (const token of nginxTokens(text)) {
        if (token.startsWith('#')) continue;
        if (!NGINX_PUNCTUATION.has(token)) {
            directive.push(argumentValue(token));
            continue;
        }
        if (token !== '}' && directive.length > 0) directives.push(directive);
        directive = [];
    }
    return directives;
}
