import { join } from 'node:path';
import { mkdir, symlink } from 'node:fs/promises';
import { GRAMMARS_FOLDER } from '#cli/config/parsers.ts';
import { CACHE_FOLDER_NAME } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { MISSING_TEST_RUN_FOLDER } from '#tests/config/setup/sandboxes.ts';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const TEST_RUN_FOLDER = (() => {
    const folder = readEnvironmentVariable('TEST_RUN_FOLDER');
    if (folder === undefined || folder === '') throw new Error(MISSING_TEST_RUN_FOLDER);
    return folder;
})();

/**
Link the grammars of `mise run setup` into a cache folder, where the source reads them.
*/
export async function linkGrammars(cache: string): Promise<void> {
    const folder = join(cache, CACHE_FOLDER_NAME);
    await mkdir(folder, { recursive: true });
    await symlink(join(REPOSITORY_ROOT, 'packages/cli', GRAMMARS_FOLDER), join(folder, GRAMMARS_FOLDER), 'junction');
}
