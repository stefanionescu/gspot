import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

import { afterAll } from 'bun:test';
import { testdir } from 'testdirs';

import { SIGNAL_EXIT_CODES } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import {
    GSPOT_LAUNCHER_PATH,
    LINE_BREAK,
    MISE_LOCK_ENVIRONMENT,
    PACKED_PACKAGES_FILE,
    TOOL_PATHS_FILE,
} from '#tests/config/setup/sandboxes.ts';
import { startNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { prepareRunFolders, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { toolModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

const resources = new AsyncDisposableStack();

afterAll(() => resources.disposeAsync());

const signalListeners = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => ({
    signal,
    listener: (): void => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises, n/no-process-exit -- reason: The signal handler must dispose resources before exiting with the signal status.
        resources.disposeAsync().finally(() => process.exit(code));
    },
}));

for (const { signal, listener } of signalListeners) process.once(signal, listener);

resources.defer(() => {
    for (const { signal, listener } of signalListeners) process.removeListener(signal, listener);
});

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
        ...MISE_LOCK_ENVIRONMENT,
        GITHUB_ACTIONS: undefined,
        MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state'),
        BUN_INSTALL_CACHE_DIR: join(TEST_RUN_FOLDER, 'bun-cache'),
        GSPOT_TEST_NPM_REGISTRY: registry.url,
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
