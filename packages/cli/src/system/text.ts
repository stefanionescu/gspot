import { distance } from 'fastest-levenshtein';
import type { TextPosition } from '#cli/types/text.ts';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, PLAIN_ARGUMENT, SIMILAR_NAME_LIMIT } from '#cli/config/text.ts';

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
 * @param knownNames the names that exist.
 * @returns the closest names.
 */
export function selectSimilarNames(name: string, knownNames: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return knownNames
        .map((knownName) => ({ knownName, score: distance(lower, knownName.toLowerCase()) }))
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
 * @param items the names.
 *
 * @returns the list text.
 */
export function formatCodeList(items: readonly string[]): string {
    const shown = items.slice(0, LIST_LIMIT);
    const rest = items.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((item) => `\`${item}\``).join(', ') + more;
}

/**
 * Format the close names of an unknown name, or an empty string when none match.
 *
 * @param name the unknown name.
 * @param knownNames the declared names.
 * @returns the Did-you-mean clause.
 */
export function formatSimilarNames(name: string, knownNames: string[]): string {
    const near = selectSimilarNames(name, knownNames);
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
    if (PLAIN_ARGUMENT.test(argument)) return argument;
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
export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
