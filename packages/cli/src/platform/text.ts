// Text and object helpers every layer shares.
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { distance } from 'fastest-levenshtein';
import type { Defined } from '#cli/types/platform/platform.ts';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, NEAR_DISTANCE_LIMIT } from '#cli/config/platform/platform.ts';

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
        .slice(0, NEAR_DISTANCE_LIMIT)
        .map(({ candidate }) => candidate);
}

/**
 * Names in code spans, separated by commas, with the count of the rest past the limit.
 * @param items the names
 * @param limit how many to show
 * @returns the list text
 */
export function codeList(items: string[], limit = LIST_LIMIT): string {
    const shown = items.slice(0, limit);
    const rest = items.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((item) => `\`${item}\``).join(', ') + more;
}

/**
 * Drops the undefined entries of an object, so exact optional types hold.
 * @param value any object
 * @returns the same object without its undefined entries
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Readers drop undefined entries so exact optional types hold, and this is the one way they do it.
export function compact<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Defined<T>;
}

/**
 * Whether a parsed value is a plain object of named values: not null, not a list, and not a date.
 * @param value the value
 * @returns whether the value holds keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * The value at a key path inside a parsed object.
 * @param value the parsed object
 * @param keys the keys, outermost first
 * @returns the value, or undefined when any key along the path is absent
 */
export function valueAt(value: unknown, keys: readonly (string | number)[]): unknown {
    let current = value;
    for (const key of keys) {
        if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/**
 * The SHA-256 digest of text or bytes, in lowercase hex.
 * @param content the text or bytes
 * @returns the digest
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Ownership records, profiles, build comparisons, and state folders name content by one digest.
export function contentDigest(content: string | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Bytes as text, when they are UTF-8.
 * @param bytes the bytes
 * @returns the text, or undefined when the bytes are not UTF-8
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Readers of files, Git listings, and manifests refuse bytes that are not UTF-8 by this one test.
export function decodedText(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}
