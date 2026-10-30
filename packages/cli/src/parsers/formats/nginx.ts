import type { DirectiveScan } from '#cli/types/parsers/formats.ts';

import {
    WORD_STOPS,
    ESCAPE_LENGTH,
    NGINX_ESCAPES,
    QUOTED_ARGUMENT,
    WORD_START_STOPS,
    ESCAPED_CHARACTER,
    NGINX_PUNCTUATION,
    WHITESPACE_CHARACTER,
} from '#cli/config/parsers/formats.ts';

function findQuotedEnd(text: string, start: number): number {
    const quote = text.charAt(start);
    for (let at = start + 1; at < text.length; at += 1) {
        if (text.charAt(at) === '\\') at += 1;
        else if (text.charAt(at) === quote) return at + 1;
    }
    return text.length;
}

function findProtectedUnitEnd(text: string, offset: number): number {
    const char = text[offset];
    if (char === '\\') return offset + 1 < text.length ? offset + ESCAPE_LENGTH : -1;
    if (char !== '$' || text[offset + 1] !== '{') return -1;
    const close = text.indexOf('}', offset + '${'.length);
    return close === -1 ? -1 : close + 1;
}

function findUnitEnd(text: string, offset: number, stops: RegExp): number {
    const special = findProtectedUnitEnd(text, offset);
    if (special !== -1) return special;
    return stops.test(text[offset] ?? '') ? offset : offset + 1;
}

function findWordEnd(text: string, offset: number): number {
    let end = findUnitEnd(text, offset, WORD_START_STOPS);
    if (end === offset) return offset;
    while (end < text.length) {
        const next = findUnitEnd(text, end, WORD_STOPS);
        if (next === end) break;
        end = next;
    }
    return end;
}

function scanComment(text: string, offset: number): DirectiveScan {
    const end = text.indexOf('\n', offset);
    const stop = end === -1 ? text.length : end;
    return { token: undefined, end: stop };
}

function scanToken(text: string, offset: number): DirectiveScan {
    const char = text[offset] ?? '';
    if (WHITESPACE_CHARACTER.test(char)) return { token: undefined, end: offset + 1 };
    if (char === '#') return scanComment(text, offset);
    if (NGINX_PUNCTUATION.has(char)) return { token: char, end: offset + 1 };
    const end = char === '"' || char === "'" ? findQuotedEnd(text, offset) : findWordEnd(text, offset);
    return end <= offset ? { token: undefined, end: offset + 1 } : { token: text.slice(offset, end), end };
}

function splitTokens(text: string): string[] {
    const found: string[] = [];
    let at = 0;
    while (at < text.length) {
        const scan = scanToken(text, at);
        if (scan.token !== undefined) found.push(scan.token);
        at = scan.end;
    }
    return found;
}

/**
Parse nginx directives. Quoted whitespace stays, and comments drop out.

@param text the nginx configuration.
@returns each directive as its name followed by its arguments.
*/
export function parseNginxDirectives(text: string): [string, ...string[]][] {
    const found: [string, ...string[]][] = [];
    let directive: string[] = [];
    for (const token of splitTokens(text)) {
        switch (token) {
            case '}': {
                directive = [];
                continue;
            }
            case ';':
            case '{': {
                const [name, ...commandArguments] = directive;
                if (name !== undefined) found.push([name, ...commandArguments]);
                directive = [];
                continue;
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
