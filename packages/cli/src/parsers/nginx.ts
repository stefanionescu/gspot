// Reads nginx configuration text into directives.
import { findQuotedEnd } from '#cli/parsers/comments.ts';
import type { DirectiveScan } from '#cli/types/parsers/nginx.ts';

import {
    WORD_STOPS,
    ESCAPE_LENGTH,
    NGINX_ESCAPES,
    QUOTED_ARGUMENT,
    WORD_START_STOPS,
    ESCAPED_CHARACTER,
    NGINX_PUNCTUATION,
} from '#cli/config/parsers/nginx.ts';

// The index past an escape pair or a braced variable that starts at at, or `-1` when neither starts there.
function findProtectedUnitEnd(text: string, at: number): number {
    const char = text[at];
    if (char === '\\') return at + 1 < text.length ? at + ESCAPE_LENGTH : -1;
    if (char !== '$' || text[at + 1] !== '{') return -1;
    const close = text.indexOf('}', at + '${'.length);
    return close === -1 ? -1 : close + 1;
}

// The index past one unit of a bare word: an escape pair, a braced variable, or one plain character.
function findUnitEnd(text: string, at: number, stops: RegExp): number {
    const special = findProtectedUnitEnd(text, at);
    if (special !== -1) return special;
    return stops.test(text[at] ?? '') ? at : at + 1;
}

// The index past the bare word that starts at at, or at itself when no word starts there.
function findWordEnd(text: string, at: number): number {
    let end = findUnitEnd(text, at, WORD_START_STOPS);
    if (end === at) return at;
    while (end < text.length) {
        const next = findUnitEnd(text, end, WORD_STOPS);
        if (next === end) break;
        end = next;
    }
    return end;
}

function scanComment(text: string, at: number): DirectiveScan {
    const end = text.indexOf('\n', at);
    const stop = end === -1 ? text.length : end;
    return { token: undefined, end: stop };
}

// The comment, punctuation, quoted argument, or bare word at at; skip a character that starts none.
function scanAt(text: string, at: number): DirectiveScan {
    const char = text[at] ?? '';
    if (/\s/u.test(char)) return { token: undefined, end: at + 1 };
    if (char === '#') return scanComment(text, at);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: at + 1 };
    const end = char === '"' || char === "'" ? findQuotedEnd(text, at) : findWordEnd(text, at);
    return end <= at ? { token: undefined, end: at + 1 } : { token: text.slice(at, end), end };
}

// The tokens of an nginx configuration: punctuation, quoted arguments, and bare words. Comments give no token.
function splitTokens(text: string): string[] {
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
 * Parse nginx directives. Quoted whitespace stays, and comments drop out.
 * @param text the nginx configuration.
 * @returns each directive as its name followed by its arguments.
 */
export function parseNginxDirectives(text: string): [string, ...string[]][] {
    const found: [string, ...string[]][] = [];
    let directive: string[] = [];
    for (const token of splitTokens(text)) {
        switch (token) {
            case '}': {
                directive = [];
                break;
            }
            case ';':
            case '{': {
                const [name, ...commandArguments] = directive;
                if (name !== undefined) found.push([name, ...commandArguments]);
                directive = [];
                break;
            }
            default: {
                directive.push(
                    token
                        .replace(QUOTED_ARGUMENT, '$2')
                        .replaceAll(ESCAPED_CHARACTER, (_, escaped: string) => NGINX_ESCAPES[escaped] ?? escaped),
                );
            }
        }
    }
    return found;
}
