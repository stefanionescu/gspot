import { join } from 'node:path';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { MISSING_TEST_RUN_FOLDER } from '#tests/config/setup/runner.ts';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const TEST_RUN_FOLDER = (() => {
    const folder = readEnvironmentVariable('TEST_RUN_FOLDER');
    if (folder === undefined || folder === '') throw new Error(MISSING_TEST_RUN_FOLDER);
    return folder;
})();
