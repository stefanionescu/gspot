import { splitByCase } from 'scule';

import {
    CONFLICT_END,
    CONFLICT_SEPARATOR,
    CONFLICT_START,
    DIGIT_BOUNDARY,
    LIST_LIMIT,
    MILLISECONDS_PER_SECOND,
    NOT_LINE_BREAK,
    NUMERIC_WORDS,
    REGEXP_SYNTAX_CHARACTERS,
    ROOT_SCOPE_MARK,
    SIMILAR_NAME_LIMIT,
    TYPO_FRACTION,
    TYPO_MIN,
    UNQUOTED_ARGUMENT,
    WORD_SEPARATORS,
} from '#cli/config/system.ts';
import type { TextPosition, TextRange } from '#cli/types/system.ts';

function measureEditDistance(from: string, to: string): number {
    const targets = [...to];
    let above = Array.from({ length: targets.length + 1 }, (_, column) => column);
    let distance = targets.length;
    for (const [row, letter] of [...from].entries()) {
        let diagonal = row;
        distance = row + 1;
        const costs = [distance];
        for (const [column, up] of above.slice(1).entries()) {
            distance = Math.min(up + 1, distance + 1, diagonal + (letter === targets[column] ? 0 : 1));
            costs.push(distance);
            diagonal = up;
        }
        above = costs;
    }
    return distance;
}

export function selectSimilarNames(name: string, names: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return names
        .map((other) => ({ name: other, score: measureEditDistance(lower, other.toLowerCase()) }))
        .filter(
            (similar) =>
                similar.score <= limit ||
                similar.name.toLowerCase().includes(lower) ||
                lower.includes(similar.name.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, SIMILAR_NAME_LIMIT)
        .map((similar) => similar.name);
}

export function formatCodeList(names: readonly string[]): string {
    const shown = names.slice(0, LIST_LIMIT);
    const rest = names.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.join(', ') + more;
}

export function formatSimilarNames(name: string, names: string[]): string {
    const near = selectSimilarNames(name, names);
    return near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
}

export function quoteArgument(argument: string): string {
    return UNQUOTED_ARGUMENT.test(argument) ? argument : `'${argument.replaceAll("'", "'\"'\"'")}'`;
}

export function quoteCommand(command: readonly string[]): string {
    return command.map((argument) => quoteArgument(argument)).join(' ');
}

export function getPosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

export function formatNameList(names: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
    return new Intl.ListFormat('en', { type }).format(names);
}

export function formatNameState(names: readonly string[], state: string): string {
    return `${formatNameList(names)} ${names.length === 1 ? 'is' : 'are'} ${state}`;
}

export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatSeconds(milliseconds: number): string {
    return `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
}

export function formatScope(path: string): string {
    return path === '' ? ROOT_SCOPE_MARK : path;
}

/**
Format the scope that stands before a check name in a report line. The root scope gets no prefix.
*/
export function formatScopePrefix(path: string): string {
    return path === '' ? '' : `${path}  `;
}

/**
Compare text by code units so paths and generated names keep the same order in every locale.
*/
export function compareText(left: string, right: string): number {
    if (left < right) return -1;
    return left > right ? 1 : 0;
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

export function escapeRegExp(text: string): string {
    return text.replaceAll(REGEXP_SYNTAX_CHARACTERS, String.raw`\$&`);
}

export function splitWords(name: string): string[] {
    return name
        .split(WORD_SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((word) => (NUMERIC_WORDS.has(word.toLowerCase()) ? [word] : word.split(DIGIT_BOUNDARY)))
        .map((word) => word.toLowerCase())
        .filter((word) => word !== '');
}

/**
List the merge-conflict marker lines of a text. A `=======` line counts only between a `<<<<<<<` line and a later
`>>>>>>>` line, because Markdown and reStructuredText underline a seven-letter title with it. Line numbers start at 1.
*/
export function listConflictMarkerLines(text: string): number[] {
    const markers: number[] = [];
    let separators: number[] | undefined;
    for (const [index, line] of text.split('\n').entries()) {
        if (CONFLICT_START.test(line)) {
            markers.push(index + 1);
            separators = [];
        } else if (CONFLICT_END.test(line)) {
            markers.push(...(separators ?? []), index + 1);
            separators = undefined;
        } else if (CONFLICT_SEPARATOR.test(line)) separators?.push(index + 1);
    }
    return markers;
}

/**
List the lines of a text that pass a test.

@returns the line numbers, from 1.
*/
export function listMatchingLines(text: string, isMatch: (line: string) => boolean): number[] {
    return text.split('\n').flatMap((line, index) => (isMatch(line) ? [index + 1] : []));
}
