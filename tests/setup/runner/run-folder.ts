import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { GRAMMARS_FOLDER } from '#cli/config/parsers.ts';
import { GIT_VARIABLE_PREFIX } from '#cli/config/repository/git.ts';
import { CACHE_FOLDER_NAME } from '#cli/config/system.ts';
import { buildSpawnEnvironment, readCacheFolder, readEnvironmentVariable } from '#cli/system/environment.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

const GIT_ISOLATION_ENVIRONMENT = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'maintenance.auto',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_KEY_1: 'gc.auto',
    GIT_CONFIG_VALUE_1: '0',
} as const;

const MISSING_TEST_RUN_FOLDER = 'Set TEST_RUN_FOLDER before running the test suite.';

const CACHE_FOLDER = 'cache';

const TEMPORARY_FOLDER = 'temporary';

const CONFIG_FOLDER = 'config';

export const REPOSITORY_ROOT = join(import.meta.dir, '../../..');

export const SHARED_GRAMMARS = join(readCacheFolder(), GRAMMARS_FOLDER);

export const TEST_RUN_FOLDER = (() => {
    const folder = readEnvironmentVariable('TEST_RUN_FOLDER');
    if (folder === undefined || folder === '') throw new Error(MISSING_TEST_RUN_FOLDER);
    return folder;
})();

export async function linkGrammars(cache: string): Promise<void> {
    const folder = join(cache, CACHE_FOLDER_NAME);
    await mkdir(folder, { recursive: true });
    await symlink(SHARED_GRAMMARS, join(folder, GRAMMARS_FOLDER), 'junction');
}

export async function prepareRunFolders(resources: AsyncDisposableStack): Promise<void> {
    const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
    const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
    const config = await mkdtemp(join(TEST_RUN_FOLDER, `${CONFIG_FOLDER}-`));
    for (const folder of [cache, temporary, config])
        resources.defer(() => rm(folder, { recursive: true, force: true }));
    await linkGrammars(cache);
    const inherited = Object.keys(buildSpawnEnvironment()).filter((name) => name.startsWith(GIT_VARIABLE_PREFIX));
    const cleared = Object.fromEntries(inherited.map((name) => [name, undefined]));
    resources.use(
        overrideEnvironment({
            ...cleared,
            ...GIT_ISOLATION_ENVIRONMENT,
            XDG_CACHE_HOME: cache,
            XDG_CONFIG_HOME: config,
            TMPDIR: temporary,
        }),
    );
}
