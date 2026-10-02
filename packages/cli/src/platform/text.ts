// Text and object helpers every layer shares.
import { codePoints } from '#cli/platform/code-points.ts';
import type { Defined } from '#cli/types/platform/platform.ts';
import { TYPO_MIN, LIST_LIMIT, TYPO_FRACTION, NEAR_DISTANCE_LIMIT } from '#cli/config/platform/platform.ts';

function distance(a: string, b: string): number {
    const right = codePoints(b);
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    let result = right.length;
    for (const [row, letter] of codePoints(a).entries()) {
        const current: number[] = [];
        let left = row + 1;
        let diagonal = 0;
        for (const [column, above] of previous.entries()) {
            if (column > 0) left = Math.min(above + 1, left + 1, diagonal + Number(letter !== right[column - 1]));
            current.push(left);
            diagonal = above;
        }
        previous = current;
        result = left;
    }
    return result;
}

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
