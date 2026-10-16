import { referenceData } from '#cli/reference.ts';

/**
 * Read the level counts and extra tools from shipped check declarations.
 * @returns one row for each level
 */
export function buildLevelRows(): { level: string; count: number; tools: string }[] {
    const { checks } = referenceData();
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
