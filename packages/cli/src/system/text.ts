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
 * Up to three candidates within an edit distance that reads as a typo, closest first.
 *
 * @param name the name as typed.
 * @param candidates the names that exist.
 *
 * @returns the closest candidates.
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
 * Names in code spans, separated by commas, with the count of the rest past the limit.
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
 * The SHA-256 digest of text or bytes, in lowercase hex.
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
 * @param value the argument.
 *
 * @returns the argument with any required shell quoting.
 */
export function quoteArgument(value: string): string {
    if (PLAIN_ARGUMENT.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * The line and column of an offset into a text, both from one.
 *
 * @param text the text.
 * @param offset the index into it.
 *
 * @returns the position.
 */
export function computePosition(text: string, offset: number): TextPosition {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Replace text with spaces while preserving code-unit positions and line breaks.
 *
 * @param text the source text.
 *
 * @returns spaces at the original text positions.
 */
export function convertToSpaces(text: string): string {
    return text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
}
