import { z } from 'zod';
import { HOOK_FILES } from '#cli/constants/repository/repository.ts';

/** The files gspot owns in the hooks directory for its stages: each hook, its original sibling, and its manager copy. */
export const HOOK_ARTIFACTS: readonly string[] = HOOK_FILES.flatMap((hook) => [
    hook,
    `${hook}.gspot-original`,
    `${hook}.gspot-manager`,
]);

export const hooksSchema = z.strictObject({
    tool: z
        .enum(['gspot', 'lefthook', 'husky', 'simple-git-hooks', 'pre-commit'])
        .describe('The tool that owns repository hooks.'),
    push: z
        .enum(['changed', 'all'])
        .default('changed')
        .describe('Check affected paths or the full tree of each pushed revision.'),
});
