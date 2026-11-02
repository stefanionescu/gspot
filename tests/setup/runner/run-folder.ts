import { join } from 'node:path';
import { mkdir, symlink } from 'node:fs/promises';
import { GRAMMARS_FOLDER } from '#cli/config/parsers.ts';
import { CACHE_FOLDER_NAME } from '#cli/config/system.ts';
import { MISSING_TEST_RUN_FOLDER } from '#tests/config/setup/sandboxes.ts';
import { readCacheFolder, readEnvironmentVariable } from '#cli/system/environment.ts';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const SHARED_GRAMMARS = join(readCacheFolder(), GRAMMARS_FOLDER);

export const TEST_RUN_FOLDER = (() => {
    const folder = readEnvironmentVariable('TEST_RUN_FOLDER');
    if (folder === undefined || folder === '') throw new Error(MISSING_TEST_RUN_FOLDER);
    return folder;
})();

/**
Link the shared grammars of `mise run setup` into a cache folder, where the source reads them.
*/
export async function linkGrammars(cache: string): Promise<void> {
    const folder = join(cache, CACHE_FOLDER_NAME);
    await mkdir(folder, { recursive: true });
    await symlink(SHARED_GRAMMARS, join(folder, GRAMMARS_FOLDER), 'junction');
}
