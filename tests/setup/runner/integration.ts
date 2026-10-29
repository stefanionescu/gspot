import { testdir } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { afterAll, setDefaultTimeout } from 'bun:test';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { rm, mkdtemp, readFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { type PackedPackage } from '#tests/types/packages.ts';
import { SIGNAL_EXIT_CODES } from '#cli/config/system/terminal.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { testModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';
import { MISE_LOCK_ENVIRONMENT, GIT_ISOLATION_ENVIRONMENT } from '#tests/config/setup/environment.ts';

import {
    LINE_BREAK,
    CACHE_FOLDER,
    TOOL_PATHS_FILE,
    TEMPORARY_FOLDER,
    GSPOT_LAUNCHER_PATH,
    PACKED_PACKAGES_FILE,
    TEST_TIMEOUT_MILLISECONDS,
} from '#tests/config/setup/runner.ts';

setDefaultTimeout(TEST_TIMEOUT_MILLISECONDS);

const resources = new AsyncDisposableStack();

afterAll(() => resources.disposeAsync());

const signalListeners = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => ({
    signal,
    listener: (): void => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises, n/no-process-exit -- reason: The signal handler must dispose resources before exiting with the signal status.
        void resources.disposeAsync().finally(() => process.exit(code));
    },
}));

for (const { signal, listener } of signalListeners) process.once(signal, listener);

resources.defer(() => {
    for (const { signal, listener } of signalListeners) process.removeListener(signal, listener);
});

const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
resources.defer(() => rm(cache, { recursive: true, force: true }));
resources.defer(() => rm(temporary, { recursive: true, force: true }));
resources.use(overrideEnvironment({ ...GIT_ISOLATION_ENVIRONMENT, XDG_CACHE_HOME: cache, TMPDIR: temporary }));

if (!(await isOnDisk(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE))))
    throw new Error('Run mise run test integration or mise run test e2e first.');

const packedPackages = JSON.parse(
    await readFile(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE), 'utf8'),
) as PackedPackage[];

for (const declaration of [cliPackage, eslintPluginPackage])
    if (packedPackages.find(({ name }) => name === declaration.name)?.version !== declaration.version)
        throw new Error('The packed packages are stale. Run mise run test integration or mise run test e2e first.');

const toolPaths = await readFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), 'utf8');

const toolFolders = toolPaths.split(LINE_BREAK).filter((folder) => folder !== '');

const work = resources.use(await testdir());

const registry = resources.use(await createNpmRegistry(work.path));

resources.use(
    overrideEnvironment({
        ...MISE_LOCK_ENVIRONMENT,
        MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state'),
        GSPOT_TEST_NPM_REGISTRY: registry.url,
        NPM_CONFIG_USERCONFIG: registry.npmrc,
        PATH: [
            dirname(join(TEST_RUN_FOLDER, GSPOT_LAUNCHER_PATH)),
            ...toolFolders,
            join(testModules, '.bin'),
            join(workspaceModules, '.bin'),
            readEnvironmentVariable('PATH') ?? '',
        ].join(delimiter),
    }),
);
