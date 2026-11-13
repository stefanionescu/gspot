import { NOT_LINE_BREAK } from '#cli/config/system.ts';
import type { TextPosition, TextRange } from '#cli/types/system.ts';

export function getPosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
Replace every character with a space and keep the line breaks, so offsets and lines stay where the text has them.
*/
export function blankText(text: string): string {
    return text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
}

export function replaceRanges(base: string, overlay: string, ranges: readonly TextRange[]): string {
    const pieces: string[] = [];
    let offset = 0;
    for (const { start, end } of ranges) {
        pieces.push(base.slice(offset, start), overlay.slice(start, end));
        offset = end;
    }
    pieces.push(base.slice(offset));
    return pieces.join('');
}

/**
List the lines of a text that pass a test.

@returns the line numbers, from 1.
*/
export function listMatchingLines(text: string, isMatch: (line: string) => boolean): number[] {
    return text.split('\n').flatMap((line, index) => (isMatch(line) ? [index + 1] : []));
}
