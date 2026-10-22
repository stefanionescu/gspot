import { CLI_REFERENCE } from './cli.ts';
import { LEVEL_ADVICE } from '../config/reference.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/settings/definitions/root.ts';

/**
 * Describe each level, count its shipped checks, and list the tools it adds.
 *
 * @returns one row for each level
 */
export function buildLevelRows(): { level: string; description: string; count: number; tools: string }[] {
    const { checks } = CLI_REFERENCE;
    const recommended = checks.filter(({ check }) => check.level === 'recommended');
    const listToolNames = (entries: typeof checks) =>
        new Set(entries.flatMap(({ check }) => (check.tool === undefined ? [] : [check.tool])));
    const usual = listToolNames(recommended);
    const extra = [...listToolNames(checks)]
        .filter((tool) => !usual.has(tool))
        .toSorted((first, second) => first.localeCompare(second));
    return [
        {
            level: 'recommended',
            description: `${LEVEL_SUMMARY} ${LEVEL_ADVICE.recommended}`,
            count: recommended.length,
            tools: '—',
        },
        {
            level: 'all',
            description: `${ALL_LEVEL_SUMMARY} ${LEVEL_ADVICE.all}`,
            count: checks.length,
            tools: extra.join(', '),
        },
    ];
}
