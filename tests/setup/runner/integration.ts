import { testdir } from 'testdirs';
import { afterAll } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, dirname, delimiter } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { stopOnSignals } from '#tests/setup/system/processes.ts';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { PACKED_PACKAGES_FILE } from '#tests/config/setup/environment.ts';
import { TOOL_PATHS_FILE, GSPOT_LAUNCHER_PATH } from '#tests/config/setup/runner.ts';
import { testModules, workspaceModules } from '#tests/setup/sandboxes/node-modules.ts';

const resources = new AsyncDisposableStack();
afterAll(() => resources.disposeAsync());
resources.use(
    stopOnSignals((code) => {
        process.exitCode = code;
        resources.disposeAsync().catch((error: unknown) => {
            process.stderr.write(`${String(error)}\n`);
        });
    }),
);

if (!(await isOnDisk(join(TEST_RUN_FOLDER, PACKED_PACKAGES_FILE))))
    throw new Error('Run mise run test integration or mise run test e2e first.');
const toolPaths = await readFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), 'utf8');
const toolFolders = toolPaths.split(/\r?\n/u).filter((folder) => folder !== '');
const work = resources.use(await testdir());
const registry = resources.use(await createNpmRegistry(work.path));
resources.use(
    overrideEnvironment({
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
