import { distance } from 'fastest-levenshtein';
import type { TextPosition } from '#cli/types/text.ts';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, UNQUOTED_ARGUMENT, SIMILAR_NAME_LIMIT } from '#cli/config/system/text.ts';

/**
 * Skip a quoted span before looking for comment openers outside it.
 *
 * @param line the source to scan.
 * @param start the first source offset.
 * @returns the offset after the quoted value.
 */
export function findQuotedEnd(line: string, start: number): number {
    const quote = line.charAt(start);
    for (let at = start + 1; at < line.length; at += 1) {
        if (line.charAt(at) === '\\') at += 1;
        else if (line.charAt(at) === quote) return at + 1;
    }
    return line.length;
}

/**
 * Select up to SUGGESTION_LIMIT names close enough to look like a typo, closest first.
 *
 * @param name the text as typed.
 * @param options the names that exist.
 * @returns the closest names.
 */
export function selectSimilarNames(name: string, options: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return options
        .map((option) => ({ knownName: option, score: distance(lower, option.toLowerCase()) }))
        .filter(
            ({ knownName, score }) =>
                score <= limit || knownName.toLowerCase().includes(lower) || lower.includes(knownName.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, SIMILAR_NAME_LIMIT)
        .map(({ knownName }) => knownName);
}

/**
 * Format names as code spans with commas, and count the rest past the limit.
 *
 * @param names the names to list.
 * @returns the list text.
 */
export function formatCodeList(names: readonly string[]): string {
    const shown = names.slice(0, LIST_LIMIT);
    const rest = names.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((name) => `\`${name}\``).join(', ') + more;
}

/**
 * Format the close names of an unknown name, or an empty string when none match.
 *
 * @param name the unknown name.
 * @param options the declared names.
 * @returns the Did-you-mean clause.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 6 files share it.
export function formatSimilarNames(name: string, options: string[]): string {
    const near = selectSimilarNames(name, options);
    return near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
}

/**
 * Quote one argument for a POSIX shell command shown to the reader.
 *
 * @param argument the command token to display without shell expansion.
 *
 * @returns the argument with any required shell quoting.
 */
export function quoteArgument(argument: string): string {
    if (UNQUOTED_ARGUMENT.test(argument)) return argument;
    return `'${argument.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * Get the line and column of an offset in a text, both from one.
 *
 * @param text the source for counting line breaks before the offset.
 * @param offset the index into it.
 * @returns the one-based line and column.
 */
export function getPosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Format a count with its singular or plural noun.
 *
 * @param count the quantity that selects the noun ending.
 * @param noun the singular word.
 * @returns the count and the noun with the matching ending.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 23 calls in 8 files share it.
export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Compare text by code units so paths and generated names keep the same order in every locale.
 *
 * @param left the first text.
 * @param right the second text.
 * @returns a negative number, zero, or a positive number for the text order.
 */
export function compareText(left: string, right: string): number {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}
