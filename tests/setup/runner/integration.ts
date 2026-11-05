import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

import { afterAll } from 'bun:test';
import { testdir } from 'testdirs';

import { readEnvironmentVariable } from '#cli/system/environment.ts';
import {
    GSPOT_LAUNCHER_PATH,
    LINE_BREAK,
    PACKED_PACKAGES_FILE,
    TOOL_PATHS_FILE,
} from '#tests/config/setup/sandboxes.ts';
import { startNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { prepareRunFolders, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { toolModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

const resources = new AsyncDisposableStack();

afterAll(() => resources.disposeAsync());

await prepareRunFolders(resources);

if (!existsSync(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE)))
    throw new Error('Run mise run test integration or mise run test e2e first.');

const toolPaths = join(TEST_RUN_FOLDER, TOOL_PATHS_FILE);

const toolFolders = existsSync(toolPaths)
    ? readFileSync(toolPaths, 'utf8')
          .split(LINE_BREAK)
          .filter((folder) => folder !== '')
    : [];

const work = resources.use(await testdir());

const registry = resources.use(await startNpmRegistry(work.path));

const launcherFolder = dirname(join(TEST_RUN_FOLDER, GSPOT_LAUNCHER_PATH));

resources.use(
    overrideEnvironment({
        GITHUB_ACTIONS: undefined,
        MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state'),
        MISE_CACHE_DIR: join(TEST_RUN_FOLDER, 'mise-cache'),
        BUN_INSTALL_CACHE_DIR: join(TEST_RUN_FOLDER, 'bun-cache'),
        NPM_CONFIG_USERCONFIG: registry.npmrc,
        npm_config_cache: join(work.path, 'npm-cache'),
        PATH: [
            launcherFolder,
            ...toolFolders,
            join(toolModules, '.bin'),
            join(workspaceModules, '.bin'),
            readEnvironmentVariable('PATH') ?? '',
        ].join(delimiter),
    }),
);
