import { mock } from 'bun:test';
import { join } from 'node:path';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

const root = join(import.meta.dir, '../../../..');
await mock.module(join(root, 'tests/setup/runner/run-folder.ts'), () => ({
    TEST_RUN_FOLDER: readEnvironmentVariable('TEST_RUN_FOLDER') ?? '',
    REPOSITORY_ROOT: root,
}));
await import(join(root, 'tests/setup/runner/integration.ts'));
