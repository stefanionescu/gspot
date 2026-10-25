import { mock } from 'bun:test';
import { join } from 'node:path';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

const repositoryRoot = join(import.meta.dir, '../../../..');
await mock.module(join(repositoryRoot, 'tests/setup/runner/run-folder.ts'), () => ({
    TEST_RUN_FOLDER: readEnvironmentVariable('TEST_RUN_FOLDER') ?? '',
    REPOSITORY_ROOT: repositoryRoot,
}));
await import(join(repositoryRoot, 'tests/setup/runner/integration.ts'));
