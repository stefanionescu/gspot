import { PAIR } from '#cli/config/platform/platform.ts';
import type { DirectiveScan } from '#cli/types/checks/tool/nginx.ts';
import { WORD_STOPS, NGINX_ESCAPES, WORD_START_STOPS, NGINX_PUNCTUATION } from '#cli/config/checks/tool/nginx.ts';

// The closing quote of an argument that opens at start, or `-1` when the quote never closes.
function quotedEnd(text: string, start: number, quote: string): number {
    for (let at = start + 1; at < text.length; at += 1) {
        if (text[at] === '\\') at += 1;
        else if (text[at] === quote) return at;
    }
    return -1;
}

// The index past an escape pair or a braced variable that starts at at, or `-1` when neither starts there.
function protectedUnitEnd(text: string, at: number): number {
    const char = text[at];
    if (char === '\\') return at + 1 < text.length ? at + PAIR : -1;
    if (char !== '$' || text[at + 1] !== '{') return -1;
    const close = text.indexOf('}', at + '${'.length);
    return close === -1 ? -1 : close + 1;
}

// The index past one unit of a bare word: an escape pair, a braced variable, or one plain character.
function unitEnd(text: string, at: number, isFirst: boolean): number {
    const special = protectedUnitEnd(text, at);
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

// The comment, punctuation, quoted argument, or bare word at at; a character that starts none is skipped.
function scanAt(text: string, at: number): DirectiveScan {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return { token: undefined, end: at + 1 };
    if (char === '#') return commentAt(text, at);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: at + 1 };
    const end = char === '"' || char === "'" ? quotedEnd(text, at, char) + 1 : wordEnd(text, at);
    return end <= at ? { token: undefined, end: at + 1 } : { token: text.slice(at, end), end };
}

// The tokens of an nginx configuration: comments, punctuation, quoted arguments, and bare words.
function tokens(text: string): string[] {
    const found: string[] = [];
    let at = 0;
    while (at < text.length) {
        const scan = scanAt(text, at);
        if (scan.token !== undefined) found.push(scan.token);
        at = scan.end;
    }
    return found;
}

/**
 * Read directive arguments without changing quoted whitespace or treating comments as configuration.
 * @param text the nginx configuration text
 * @returns each directive as its name followed by its arguments
 */
export function directives(text: string): [string, ...string[]][] {
    const found: [string, ...string[]][] = [];
    let directive: string[] = [];
    for (const token of tokens(text)) {
        if (token.startsWith('#')) continue;
        switch (token) {
            case '}': {
                directive = [];
                break;
            }
            case ';':
            case '{': {
                const [name, ...args] = directive;
                if (name !== undefined) found.push([name, ...args]);
                directive = [];
                break;
            }
            default: {
                directive.push(
                    token
                        .replace(/^(["'])([\s\S]*)\1$/u, '$2')
                        .replaceAll(/\\([trn"'\\])/gu, (_, escaped: string) => NGINX_ESCAPES[escaped] ?? escaped),
                );
            }
        }
    }
    return found;
}
