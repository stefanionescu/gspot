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

export const REQUIRED_FILE_EXPLANATIONS = {
    [DOCS_RULES.missingReadme]: {
        description: 'Each scope has a `README.md`.',
        why: 'A reader of the scope needs to know what it does and how to start.',
        fix: 'Add a `README.md` that says what the scope does and how to start.',
        example: 'A scope `packages/api` without `packages/api/README.md` reports `missing-readme`.',
    },
    [DOCS_RULES.missingLicense]: {
        description: 'The repository root has a license file.',
        why: 'Without a license, a reader does not know whether they may use the code.',
        fix: 'Add a `LICENSE` file at the repository root.',
        example: 'A repository with only `docs/LICENSE` reports `missing-license`.',
    },
} as const satisfies RuleExplanations;
