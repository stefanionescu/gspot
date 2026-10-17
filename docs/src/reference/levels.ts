import { readReferenceData } from '#cli/reference.ts';

/**
 * Count the shipped checks at each level, and list the tools each level adds.
 * @returns one row for each level
 */
export function buildLevelRows(): { level: string; count: number; tools: string }[] {
    const { checks } = readReferenceData();
    const recommended = checks.filter(({ check }) => check.level === 'recommended');
    const listToolNames = (entries: typeof checks) =>
        new Set(entries.flatMap(({ check }) => (check.tool === undefined ? [] : [check.tool])));
    const usual = listToolNames(recommended);
    const extra = [...listToolNames(checks)]
        .filter((tool) => !usual.has(tool))
        .toSorted((first, second) => first.localeCompare(second));
    return [
        { level: 'recommended', count: recommended.length, tools: 'none' },
        { level: 'all', count: checks.length, tools: extra.join(', ') },
    ];
}
