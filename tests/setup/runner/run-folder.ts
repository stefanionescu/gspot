import { join } from 'node:path';
import { GRAMMARS_FOLDER } from '#cli/config/parsers.ts';
import { CACHE_FOLDER_NAME } from '#cli/config/system.ts';
import { rm, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { readCacheFolder, readEnvironmentVariable } from '#cli/system/environment.ts';

import {
    CACHE_FOLDER,
    CONFIG_FOLDER,
    TEMPORARY_FOLDER,
    MISSING_TEST_RUN_FOLDER,
    GIT_ISOLATION_ENVIRONMENT,
} from '#tests/config/setup/sandboxes.ts';

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

/**
Create the cache, temporary, and config folders of a test file, and point the isolated environment at them. The
resources remove the folders and restore the environment.
*/
export async function prepareRunFolders(resources: AsyncDisposableStack): Promise<void> {
    const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
    const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
    const config = await mkdtemp(join(TEST_RUN_FOLDER, `${CONFIG_FOLDER}-`));
    for (const folder of [cache, temporary, config])
        resources.defer(() => rm(folder, { recursive: true, force: true }));
    await linkGrammars(cache);
    resources.use(
        overrideEnvironment({
            ...GIT_ISOLATION_ENVIRONMENT,
            XDG_CACHE_HOME: cache,
            XDG_CONFIG_HOME: config,
            TMPDIR: temporary,
        }),
    );
}
