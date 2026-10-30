import type { TextRange, TextPosition } from '#cli/types/text.ts';

import {
    TYPO_MIN,
    LIST_LIMIT,
    TYPO_FRACTION,
    UNQUOTED_ARGUMENT,
    SIMILAR_NAME_LIMIT,
} from '#cli/config/system/system.ts';

/**
Select up to SIMILAR_NAME_LIMIT names close enough to look like a typo, closest first.

@param name the text as typed.
@param names the names that exist.
*/
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

/**
Count the fewest inserted, deleted, or replaced characters that turn one text into the other.

@param from the first text.
@param to the second text.
*/
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

/**
Join names with commas, and count the rest past the limit.

@param names the names to list.
*/
export function formatCodeList(names: readonly string[]): string {
    const shown = names.slice(0, LIST_LIMIT);
    const rest = names.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.join(', ') + more;
}

/**
Format the close names of an unknown name, or an empty string when none match.

@param name the unknown name.
@param names the declared names.
@returns the Did-you-mean clause.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands, configurations, and settings validation word the close-name suggestion through it.
export function formatSimilarNames(name: string, names: string[]): string {
    const near = selectSimilarNames(name, names);
    return near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
}

/**
Quote one argument for a POSIX shell command shown to the reader.

@param argument the command token to display without shell expansion.

@returns the argument with any required shell quoting.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands, CI generation, and settings messages quote a shell argument by this one rule.
export function quoteArgument(argument: string): string {
    return UNQUOTED_ARGUMENT.test(argument) ? argument : `'${argument.replaceAll("'", "'\"'\"'")}'`;
}

/**
Quote each argument of a command for a POSIX shell, and join them with spaces.

@param command the program and its arguments.

@returns the command line, which a shell runs as the same arguments.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers print a command line quoted by this one rule.
export function quoteCommand(command: readonly string[]): string {
    return command.map((argument) => quoteArgument(argument)).join(' ');
}

/**
Get the line and column of an offset in a text, both from one.

@param text the source for counting line breaks before the offset.
@param offset the index into it.
*/
export function getPosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
Format a count with its singular or plural noun.

@param count the quantity that selects the noun ending.
@param noun the singular word.
@returns the count and the noun with the matching ending.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Messages in many layers form a counted noun with this one plural rule.
export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
Compare text by code units so paths and generated names keep the same order in every locale.

@param left the first text.
@param right the second text.
@returns a negative number, zero, or a positive number for the text order.
*/
export function compareText(left: string, right: string): number {
    if (left < right) return -1;
    return left > right ? 1 : 0;
}

/**
Replace ranges of one text with the same ranges of another text of the same length.

@param base the text outside the ranges.
@param overlay the text inside the ranges.
@param ranges the start and end offsets, in order.
*/
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
