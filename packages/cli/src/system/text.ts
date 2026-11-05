import { splitByCase } from 'scule';

import {
    DIGIT_BOUNDARY,
    LIST_LIMIT,
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

const CONFLICT_START = /^<{7}(?: |$)/u;

const CONFLICT_SEPARATOR = /^={7}(?: |$)/u;

const CONFLICT_END = /^>{7}(?: |$)/u;

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
export function formatSimilarNames(name: string, names: string[]): string {
    const near = selectSimilarNames(name, names);
    return near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
}

/**
Quote one argument for a POSIX shell command shown to the reader.

@param argument the command token to display without shell expansion.
*/
export function quoteArgument(argument: string): string {
    return UNQUOTED_ARGUMENT.test(argument) ? argument : `'${argument.replaceAll("'", "'\"'\"'")}'`;
}

/**
Quote each argument of a command for a POSIX shell, and join them with spaces.

@param command the program and its arguments.

@returns the command line, which a shell runs as the same arguments.
*/
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
Join names in a sentence, such as `a, b, and c`.

@param names the names to join.
@param type `conjunction` joins with and, and `disjunction` with or.
*/
export function formatNameList(names: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
    return new Intl.ListFormat('en', { type }).format(names);
}

/**
Format a count with its singular or plural noun.

@param count the quantity that selects the noun ending.
@param noun the singular word.
*/
export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
Format a scope the way --scope accepts it.

@param path the scope path, empty at the repository root.
@returns the path, or the mark of the root.
*/
export function formatScope(path: string): string {
    return path === '' ? ROOT_SCOPE_MARK : path;
}

/**
Compare text by code units so paths and generated names keep the same order in every locale.

@param left the first text.
@param right the second text.
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

/**
Escape text so that a regular expression matches it literally.

@param text the text to match.
*/
export function escapeRegExp(text: string): string {
    return text.replaceAll(REGEXP_SYNTAX_CHARACTERS, String.raw`\$&`);
}

/**
Splits a name into lowercase parts: `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.

@param name the identifier.
*/
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
`>>>>>>>` line, because Markdown and reStructuredText underline a seven-letter title with it.

@param text the file text.
@returns the indexes of the marker lines, counted from 0, in order.
*/
export function listConflictMarkerLines(text: string): number[] {
    const markers: number[] = [];
    let separators: number[] | undefined;
    for (const [index, line] of text.split('\n').entries()) {
        if (CONFLICT_START.test(line)) {
            markers.push(index);
            separators = [];
        } else if (CONFLICT_END.test(line)) {
            markers.push(...(separators ?? []), index);
            separators = undefined;
        } else if (CONFLICT_SEPARATOR.test(line)) separators?.push(index);
    }
    return markers.toSorted((left, right) => left - right);
}
