// Code lines of a shell script: comments stripped with the quotes respected, blanks dropped.
import type { CodeLine } from '#cli/structure/types.ts';
import { DIRECTORY_CONSTANT_SIGNS, DIRECTORY_CONSTANT_START } from '#cli/structure/structure-definitions.ts';

const QUOTES = new Set(["'", '"']);
const DECLARATION_WORDS = new Set(['readonly', 'export', 'declare', 'local']);

function quoteAfter(quote: string | undefined, char: string): string | undefined {
    if (quote !== undefined) return char === quote ? undefined : quote;
    return QUOTES.has(char) ? char : undefined;
}

function commentStart(line: string): number {
    let quote: string | undefined;
    let isEscaped = false;
    for (let index = 0; index < line.length; index += 1) {
        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        const char = line.charAt(index);
        if (char === '\\') isEscaped = true;
        else if (char === '#' && quote === undefined) return index;
        else quote = quoteAfter(quote, char);
    }
    return -1;
}

/**
 * The line without its trailing comment. A `#` inside quotes or after a backslash is kept.
 * @param line the line
 * @returns the code part
 */
export function withoutComment(line: string): string {
    const start = commentStart(line);
    return start === -1 ? line : line.slice(0, start);
}

/**
 * The non-blank, non-comment lines with their one-based numbers.
 * @param lines the file's lines
 * @returns the code lines, trimmed
 */
export function codeLines(lines: string[]): CodeLine[] {
    return lines.flatMap((line, index) => {
        const code = withoutComment(line).trim();
        return code === '' ? [] : [{ number: index + 1, code }];
    });
}

/**
 * The code line without a leading declaration word and its flags: `readonly -a NAME=1` gives `NAME=1`.
 * @param code a code line
 * @returns the assignment or command that follows the declaration word
 */
export function withoutDeclaration(code: string): string {
    const words = code.split(/\s+/u);
    if (!DECLARATION_WORDS.has(words[0] ?? '')) return code;
    let index = 1;
    while ((words[index] ?? '').startsWith('-')) index += 1;
    return words.slice(index).join(' ');
}

/**
 * True when a code line computes a directory constant from the script's own location.
 * @param code a code line
 * @returns whether it is the shape `NAME=$(cd <the directory of BASH_SOURCE[0]> && pwd)`
 */
export function isDirectoryConstant(code: string): boolean {
    return (
        DIRECTORY_CONSTANT_START.test(withoutDeclaration(code)) &&
        DIRECTORY_CONSTANT_SIGNS.every((sign) => code.includes(sign))
    );
}
