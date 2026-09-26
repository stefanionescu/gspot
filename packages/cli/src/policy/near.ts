import { codePoints } from '#cli/platform/code-points.ts';

const NEAR_LIMIT = 3;
const TYPO_MIN = 2;
const TYPO_FRACTION = 3;

function distance(a: string, b: string): number {
    const right = codePoints(b);
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    let result = right.length;
    for (const [row, letter] of codePoints(a).entries()) {
        const current: number[] = [];
        let left = row + 1;
        let diagonal = 0;
        for (const [column, above] of previous.entries()) {
            if (column > 0) left = Math.min(above + 1, left + 1, diagonal + (letter === right[column - 1] ? 0 : 1));
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
export function nearMatches(name: string, candidates: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return candidates
        .map((candidate) => ({ candidate, score: distance(lower, candidate.toLowerCase()) }))
        .filter(
            ({ candidate, score }) =>
                score <= limit || candidate.toLowerCase().includes(lower) || lower.includes(candidate.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, NEAR_LIMIT)
        .map(({ candidate }) => candidate);
}
