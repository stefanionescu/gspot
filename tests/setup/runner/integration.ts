import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { afterAll, setDefaultTimeout } from 'bun:test';
import { rm, mkdtemp, readFile } from 'node:fs/promises';
import { SIGNAL_EXIT_CODES } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { startNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { linkGrammars, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { toolModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    LINE_BREAK,
    CACHE_FOLDER,
    TOOL_PATHS_FILE,
    TEMPORARY_FOLDER,
    GSPOT_LAUNCHER_PATH,
    PACKED_PACKAGES_FILE,
    MISE_LOCK_ENVIRONMENT,
    GIT_ISOLATION_ENVIRONMENT,
    TEST_TIMEOUT_MILLISECONDS,
} from '#tests/config/setup/sandboxes.ts';

setDefaultTimeout(TEST_TIMEOUT_MILLISECONDS);

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

const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
await linkGrammars(cache);
resources.defer(() => rm(cache, { recursive: true, force: true }));
resources.defer(() => rm(temporary, { recursive: true, force: true }));
resources.use(overrideEnvironment({ ...GIT_ISOLATION_ENVIRONMENT, XDG_CACHE_HOME: cache, TMPDIR: temporary }));

if (!existsSync(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE)))
    throw new Error('Run mise run test integration or mise run test e2e first.');

const toolPaths = await readFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), 'utf8');

const toolFolders = toolPaths.split(LINE_BREAK).filter((folder) => folder !== '');

const work = resources.use(await testdir());

const registry = resources.use(await startNpmRegistry(work.path));

resources.use(
    overrideEnvironment({
        ...MISE_LOCK_ENVIRONMENT,
        MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state'),
        GSPOT_TEST_NPM_REGISTRY: registry.url,
        NPM_CONFIG_USERCONFIG: registry.npmrc,
        PATH: [
            dirname(join(TEST_RUN_FOLDER, GSPOT_LAUNCHER_PATH)),
            ...toolFolders,
            join(toolModules, '.bin'),
            join(workspaceModules, '.bin'),
            readEnvironmentVariable('PATH') ?? '',
        ].join(delimiter),
    }),
);
