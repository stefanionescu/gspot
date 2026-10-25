import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { join, dirname, delimiter } from 'node:path';
import { afterAll, setDefaultTimeout } from 'bun:test';
import { isOnDisk } from '#tests/setup/system/files.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { PackedPackage } from '#tests/types/packages.ts';
import { stopOnSignals } from '#tests/setup/system/processes.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { TOOL_PATHS_FILE, GSPOT_LAUNCHER_PATH } from '#tests/config/setup/runner.ts';
import { testModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    PACKED_PACKAGES_FILE,
    MISE_LOCK_ENVIRONMENT,
    TEST_TIMEOUT_MILLISECONDS,
} from '#tests/config/setup/environment.ts';

setDefaultTimeout(TEST_TIMEOUT_MILLISECONDS);

const resources = new AsyncDisposableStack();
afterAll(() => resources.disposeAsync());
resources.use(
    stopOnSignals((code) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises, n/no-process-exit -- reason: The signal handler must dispose resources before exiting with the signal status.
        void resources.disposeAsync().finally(() => process.exit(code));
    }),
);

if (!(await isOnDisk(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE))))
    throw new Error('Run mise run test integration or mise run test e2e first.');
const packedPackages = JSON.parse(
    await readFile(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE), 'utf8'),
) as PackedPackage[];
for (const declaration of [cliPackage, eslintPluginPackage])
    if (packedPackages.find(({ name }) => name === declaration.name)?.version !== declaration.version)
        throw new Error('The packed packages are stale. Run mise run test integration or mise run test e2e first.');
const toolPaths = await readFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), 'utf8');
const toolFolders = toolPaths.split(/\r?\n/u).filter((folder) => folder !== '');
const work = resources.use(await testdir());
const registry = resources.use(await createNpmRegistry(work.path));
const overrides = overrideEnvironment({
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
});
resources.use(overrides);
