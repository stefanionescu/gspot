import { readReferenceData } from '#cli/reference.ts';
import { LEVEL_DESCRIPTIONS } from '../config/reference.ts';

/**
 * Describe each level, count its shipped checks, and list the tools it adds.
 * @returns one row for each level
 */
export function buildLevelRows(): { level: string; description: string; count: number; tools: string }[] {
    const { checks } = readReferenceData();
    const recommended = checks.filter(({ check }) => check.level === 'recommended');
    const listToolNames = (entries: typeof checks) =>
        new Set(entries.flatMap(({ check }) => (check.tool === undefined ? [] : [check.tool])));
    const usual = listToolNames(recommended);
    const extra = [...listToolNames(checks)]
        .filter((tool) => !usual.has(tool))
        .toSorted((first, second) => first.localeCompare(second));
    return [
        { level: 'recommended', description: LEVEL_DESCRIPTIONS.recommended, count: recommended.length, tools: '—' },
        { level: 'all', description: LEVEL_DESCRIPTIONS.all, count: checks.length, tools: extra.join(', ') },
    ];
}
