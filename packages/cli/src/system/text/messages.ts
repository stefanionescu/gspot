import {
    LIST_LIMIT,
    MILLISECONDS_PER_SECOND,
    SIMILAR_NAME_LIMIT,
    TYPO_FRACTION,
    TYPO_MIN,
} from '#cli/config/system.ts';

function measureEditDistance(from: string, to: string): number {
    const targets = [...to];
    let above = Array.from({ length: targets.length + 1 }, (_, column) => column);
    let distance = targets.length;
    for (const [row, letter] of [...from].entries()) {
        let diagonal = row;
        distance = row + 1;
        const costs = [distance];
        for (const [column, up] of above.slice(1).entries()) {
            distance = Math.min(up + 1, distance + 1, diagonal + (letter === targets[column] ? 0 : 1));
            costs.push(distance);
            diagonal = up;
        }
        above = costs;
    }
    return distance;
}

export function selectSimilarNames(name: string, names: string[]): string[] {
    const lower = name.toLowerCase();
    const limit = Math.max(TYPO_MIN, Math.floor(name.length / TYPO_FRACTION));
    return names
        .map((other) => ({ name: other, score: measureEditDistance(lower, other.toLowerCase()) }))
        .filter(
            (similar) =>
                similar.score <= limit ||
                similar.name.toLowerCase().includes(lower) ||
                lower.includes(similar.name.toLowerCase()),
        )
        .toSorted((a, b) => a.score - b.score)
        .slice(0, SIMILAR_NAME_LIMIT)
        .map((similar) => similar.name);
}

export function formatCodeList(names: readonly string[]): string {
    const shown = names.slice(0, LIST_LIMIT);
    const rest = names.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.join(', ') + more;
}

export function formatSimilarNames(name: string, names: string[]): string {
    const near = selectSimilarNames(name, names);
    return near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
}

export function formatNameList(names: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
    return new Intl.ListFormat('en', { type }).format(names);
}

export function formatNameState(names: readonly string[], state: string): string {
    return `${formatNameList(names)} ${names.length === 1 ? 'is' : 'are'} ${state}`;
}

export function formatCount(count: number, noun: string): string {
    return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatSeconds(milliseconds: number): string {
    return `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
}
