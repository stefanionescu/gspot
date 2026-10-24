import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { runtimePinsSchema } from '#tests/schemas/runner.ts';
import { TOOL_PINS_FILE, TEST_RUN_HASH_LENGTH, TEST_RUN_FOLDER_NAME } from '#tests/config/setup/runner.ts';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const TEST_RUN_FOLDER = join(
    tmpdir(),
    `${TEST_RUN_FOLDER_NAME}-${createHash('sha256')
        .update(REPOSITORY_ROOT)
        .digest('hex')
        .slice(0, TEST_RUN_HASH_LENGTH)}`,
);

/**
Read this checkout's validated Bun and Node pins.

@returns the two pinned runtime versions.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export async function readRuntimePins(): Promise<{ bun: string; node: string }> {
    const runtimeSettings: unknown = parse(await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8'));
    return runtimePinsSchema.parse(runtimeSettings).tools;
}
