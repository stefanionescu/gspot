// Closest-match suggestions for a mistyped name.

function distance(a: string, b: string): number {
    const rows: number[][] = [];
    for (let i = 0; i <= a.length; i += 1) rows.push([i]);
    for (let j = 1; j <= b.length; j += 1) rows[0]![j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
        }
    }
    return rows[a.length]![b.length]!;
}

/** Up to three candidates within an edit distance that reads as a typo, closest first. */
export function nearMatches(name: string, candidates: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(2, Math.floor(name.length / 3));
    return candidates
        .map((candidate) => ({ candidate, score: distance(lower, candidate.toLowerCase()) }))
        .filter(
            ({ candidate, score }) =>
                score <= limit || candidate.toLowerCase().includes(lower) || lower.includes(candidate.toLowerCase()),
        )
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(({ candidate }) => candidate);
}
