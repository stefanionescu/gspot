// Shared text operations, content digests, and checked UTF-8 decoding.
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { distance } from 'fastest-levenshtein';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, SUGGESTION_LIMIT } from '#cli/config/platform/text.ts';

/**
 * Up to three candidates within an edit distance that reads as a typo, closest first.
 * @param name the name as typed
 * @param candidates the names that exist
 * @returns the closest candidates
 */
export function similar(name: string, candidates: string[]): string[] {
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
 * @param items the names
 * @returns the list text
 */
export function codeList(items: string[]): string {
    const shown = items.slice(0, LIST_LIMIT);
    const rest = items.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((item) => `\`${item}\``).join(', ') + more;
}

/**
 * The SHA-256 digest of text or bytes, in lowercase hex.
 * @param content the text or bytes
 * @returns the digest
 */
export function contentDigest(content: string | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Bytes as text, when they are UTF-8.
 * @param bytes the bytes
 * @returns the text, or undefined when the bytes are not UTF-8
 */
export function decodeUtf8(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}

/**
 * The code points of a text, one string each.
 * @param text the text
 * @returns the code points in order
 */
export function codePoints(text: string): string[] {
    const characters: string[] = [];
    for (const character of text) characters.push(character);
    return characters;
}

/**
 * Escape literal text for insertion into a regular expression pattern.
 * @param text the literal text
 * @returns text with regular expression operators escaped
 */
export function escapeRegExp(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}
