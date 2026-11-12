import { GENERATOR_OUTPUT_RULES, SYNTAX_RULE } from '#cli/config/configurations/shared.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const SYNTAX_EXPLANATIONS = {
    [SYNTAX_RULE]: {
        description: 'A file that the check reads parses without errors.',
        why: 'The check cannot judge a file that it cannot parse.',
        fix: 'Fix the syntax at the reported line.',
        example: 'A JSON file that ends after `{ "name": "app"` reports `syntax`.',
    },
} as const satisfies RuleExplanations;

export const GENERATOR_OUTPUT_EXPLANATIONS = {
    [GENERATOR_OUTPUT_RULES.stale]: {
        description: 'Each committed file holds what the generator command writes now.',
        why: 'A stale file describes code or a schema that has changed since.',
        fix: 'Run the generator command, and commit the new file after you read the diff.',
        example: 'A schema change without the new generated file reports `stale`.',
    },
    [GENERATOR_OUTPUT_RULES.missing]: {
        description: 'Each file that the check compares with the generator output exists.',
        why: 'The code and the checks that read the file need it in the repository.',
        fix: 'Run the generator command, then add the file to Git.',
        example: 'A deleted types file that the generator writes reports `missing`.',
    },
    [GENERATOR_OUTPUT_RULES.untracked]: {
        description: 'Git tracks each file that the generator writes.',
        why: 'A file that only one clone holds differs between clones, and the checks read the committed one.',
        fix: 'Add the file with `git add`, and commit it.',
        example: 'A generated migration that nobody added to Git reports `untracked`.',
    },
} as const satisfies RuleExplanations;
