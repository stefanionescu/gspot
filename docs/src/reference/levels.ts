import { CLI_REFERENCE } from '#docs/reference/cli.ts';
import { LEVEL_ADVICE } from '#docs/config/reference.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/settings/definitions/root.ts';

/**
Describe each level, count its shipped checks, and list the tools it adds.
*/
export function buildLevelRows(): { level: string; description: string; count: number; tools: string }[] {
    const { checks } = CLI_REFERENCE;
    const defaultLevelChecks = checks.filter(({ check }) => check.level === 'basic');
    const defaultLevelTools = new Set(
        defaultLevelChecks.flatMap(({ check }) => (check.tool === undefined ? [] : check.tool)),
    );
    const allLevelTools = [...new Set(checks.flatMap(({ check }) => (check.tool === undefined ? [] : check.tool)))]
        .filter((tool) => !defaultLevelTools.has(tool))
        .toSorted((first, second) => first.localeCompare(second));
    return [
        {
            level: 'basic',
            description: `${LEVEL_SUMMARY} ${LEVEL_ADVICE.basic}`,
            count: defaultLevelChecks.length,
            tools: '—',
        },
        {
            level: 'all',
            description: `${ALL_LEVEL_SUMMARY} ${LEVEL_ADVICE.all}`,
            count: checks.length,
            tools: allLevelTools.join(', '),
        },
    ];
}
