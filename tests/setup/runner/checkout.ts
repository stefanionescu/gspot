// Names the test-run folder of this checkout, and reads the Bun and Node versions that it pins.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { runtimeSettingsSchema } from '#tests/schemas/preparation.ts';
import { DIGEST_ALGORITHM } from '#cli/config/checks/language/swift/cache.ts';
import { PINNED_TOOLS_FILE, TEST_RUN_HASH_LENGTH, TEST_RUN_FOLDER_NAME } from '#tests/config/setup/runner.ts';

/** The packages and tool paths of the test run for this checkout, named after the checkout folder. */
export const TEST_RUN_FOLDER = join(
    tmpdir(),
    `${TEST_RUN_FOLDER_NAME}-${createHash(DIGEST_ALGORITHM)
        .update(join(import.meta.dir, '../../..'))
        .digest('hex')
        .slice(0, TEST_RUN_HASH_LENGTH)}`,
);

/**
 * Read this checkout's validated Bun and Node pins.
 *
 * @returns the two pinned runtime versions.
 */
export async function readRuntimePins(): Promise<{ bun: string; node: string }> {
    const runtimeSettings: unknown = parse(
        await readFile(join(import.meta.dir, '../../..', PINNED_TOOLS_FILE), 'utf8'),
    );
    return runtimeSettingsSchema.parse(runtimeSettings).tools;
}
