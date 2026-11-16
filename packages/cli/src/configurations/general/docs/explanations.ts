import type { RuleExplanations } from '#cli/types/tools.ts';
import { DOCS_RULES } from '#cli/config/configurations/docs.ts';

export const MISSING_PATH_EXPLANATIONS = {
    [DOCS_RULES.missingPath]: {
        description: 'Each path in Markdown prose or in a shell code block leads to a tracked file or folder.',
        why: 'A reader who follows a missing path finds nothing.',
        fix: 'Correct the path, or put example paths in a code block with a `title=` attribute.',
        example: '`Edit src/old-name.ts` after a rename to `src/name.ts` reports `missing-path`.',
    },
    [DOCS_RULES.missingTask]: {
        description: 'Each `mise run`, `npm run`, `pnpm run`, `yarn run`, or `bun run` runs a task that exists.',
        why: 'A reader who runs a missing task gets an error.',
        fix: 'Correct the task name, or add the task.',
        example: '`mise run tests` in a project whose task is `test` reports `missing-task`.',
    },
} as const satisfies RuleExplanations;
