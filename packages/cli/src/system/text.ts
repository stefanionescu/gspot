// Formats text, computes source positions, and hashes content.

import { createHash } from 'node:crypto';
import { distance } from 'fastest-levenshtein';
import type { TextPosition } from '#cli/types/text.ts';

import {
    TYPO_MIN,
    LIST_LIMIT,
    TYPO_FRACTION,
    NOT_LINE_BREAK,
    PLAIN_ARGUMENT,
    DIGEST_ALGORITHM,
    SUGGESTION_LIMIT,
} from '#cli/config/text.ts';

/**
 * Select up to three names close enough to look like a typo, closest first.
 *
 * @param name the text as typed.
 * @param candidates the names that exist.
 *
 * @returns the closest names.
 */
export function selectSimilarNames(name: string, candidates: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return candidates
        .map((candidate) => ({ candidate, score: distance(lower, candidate.toLowerCase()) }))
        .filter(
            ({ candidate, score }) =>
                score <= limit || candidate.toLowerCase().includes(lower) || lower.includes(candidate.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, SUGGESTION_LIMIT)
        .map(({ candidate }) => candidate);
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
 * Name an unknown check or configuration, and suggest close names.
 *
 * @param noun what the name stands for.
 * @param name the requested name.
 * @param known the declared names.
 * @returns the sentence, with the close names it suggests.
 */
export function formatUnknownName(noun: 'check' | 'configuration', name: string, known: string[]): string {
    const suggestions = selectSimilarNames(name, known);
    return `There is no ${noun} called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + formatCodeList(suggestions) + '?' : ''}`;
}

/**
 * Hash text or bytes with SHA-256, in lowercase hex.
 *
 * @param content the text or bytes.
 *
 * @returns the digest.
 */
export function hashContent(content: string | Uint8Array): string {
    return createHash(DIGEST_ALGORITHM).update(content).digest('hex');
}

/**
 * Quote one argument for a POSIX shell command shown to the reader.
 *
 * @param value the command token to display without shell expansion.
 *
 * @returns the argument with any required shell quoting.
 */
export function quoteArgument(value: string): string {
    if (PLAIN_ARGUMENT.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * Compute the line and column of an offset in a text, both from one.
 *
 * @param text the source for counting line breaks before the offset.
 * @param offset the index into it.
 *
 * @returns the one-based line and column.
 */
export function computePosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Replace text with spaces, and keep code-unit positions and line breaks.
 *
 * @param text the source.
 *
 * @returns spaces at the original text positions.
 */
export function convertToSpaces(text: string): string {
    return text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
}

/**
 * Print a count with its singular or plural noun.
 *
 * @param value the quantity that selects the noun ending.
 * @param noun the singular word.
 * @returns the count and the noun with the matching ending.
 */
export function formatCount(value: number, noun: string): string {
    return `${String(value)} ${noun}${value === 1 ? '' : 's'}`;
}
