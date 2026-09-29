// The repository analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { fileIntegrity } from '#cli/checks/repository/files.ts';
import { largeFiles } from '#cli/checks/repository/large-files.ts';
import { taskPolicy } from '#cli/checks/repository/task-policy.ts';
import { suppressions } from '#cli/checks/repository/suppressions.ts';
import { generatedDrift } from '#cli/checks/repository/generated-drift.ts';
import { allowlistsMatch } from '#cli/checks/repository/allowlists-match.ts';
import { trackedDependencies } from '#cli/checks/repository/tracked-dependencies.ts';

export const REPOSITORY_ANALYSES: Record<string, Engine> = {
    'generated-drift': generatedDrift,
    files: fileIntegrity,
    suppressions,
    'allowlists-match': allowlistsMatch,
    'task-policy': taskPolicy,
    'large-files': largeFiles,
    'tracked-dependencies': trackedDependencies,
};
