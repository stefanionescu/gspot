import { CLI_REFERENCE } from '#cli/reference.ts';
import { LEVEL_ADVICE } from '#docs/config/reference.ts';

/**
Describe each level, and list the tools it adds.
*/
export function buildLevelRows(): Array<{ level: string; description: string; tools: string }> {
    return [
        {
            level: 'basic',
            description: `${CLI_REFERENCE.levelSummaries.basic} ${LEVEL_ADVICE.basic}`,
            tools: 'None',
        },
        {
            level: 'all',
            description: `${CLI_REFERENCE.levelSummaries.all} ${LEVEL_ADVICE.all}`,
            tools: CLI_REFERENCE.allLevelTools.join(', '),
        },
    ];
}
