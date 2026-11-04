import { CLI_REFERENCE } from '#cli/reference.ts';
import { LEVEL_ADVICE } from '#docs/config/reference.ts';

/**
Describe each level, count its shipped checks, and list the tools it adds.
*/
export function buildLevelRows(): Array<{ level: string; description: string; count: number; tools: string }> {
    const { checks } = CLI_REFERENCE;
    const defaultLevelChecks = checks.filter(({ check }) => check.level === 'basic');
    return [
        {
            level: 'basic',
            description: `${CLI_REFERENCE.levelSummaries.basic} ${LEVEL_ADVICE.basic}`,
            count: defaultLevelChecks.length,
            tools: 'None',
        },
        {
            level: 'all',
            description: `${CLI_REFERENCE.levelSummaries.all} ${LEVEL_ADVICE.all}`,
            count: checks.length,
            tools: CLI_REFERENCE.allLevelTools.join(', '),
        },
    ];
}
