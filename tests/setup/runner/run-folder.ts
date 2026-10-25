import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { TEST_RUN_HASH_LENGTH, TEST_RUN_FOLDER_NAME } from '#tests/config/setup/runner.ts';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const TEST_RUN_FOLDER = join(
    tmpdir(),
    `${TEST_RUN_FOLDER_NAME}-${createHash('sha256')
        .update(REPOSITORY_ROOT)
        .digest('hex')
        .slice(0, TEST_RUN_HASH_LENGTH)}`,
);
