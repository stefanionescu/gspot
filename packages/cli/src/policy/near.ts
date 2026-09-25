const NEAR_LIMIT = 3;
const TYPO_MIN = 2;
const TYPO_FRACTION = 3;

function distance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let row = 1; row <= a.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= b.length; column += 1) {
            const cost = a[row - 1] === b[column - 1] ? 0 : 1;
            const above = previous[column]!;
            const left = current[column - 1]!;
            const diagonal = previous[column - 1]!;
            current.push(Math.min(above + 1, left + 1, diagonal + cost));
        }
        previous = current;
    }
    return previous[b.length]!;
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
