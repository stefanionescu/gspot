// Bun loads this file before each integration and e2e test file. It starts a local npm registry, and puts the
// prepared gspot and the pinned tools on `PATH`.
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

const work = resources.use(await testdir());

const stop = (code: number): void => {
    process.exitCode = code;
    resources.disposeAsync().catch((error: unknown) => {
        process.stderr.write(`${String(error)}\n`);
        process.exitCode = 1;
    });
};

resources.use(stopOnSignals(stop));

afterAll(async () => {
    await resources.disposeAsync();
});

try {
    const folder = TEST_RUN_FOLDER;
    if (!(await isOnDisk(join(folder, PACKED_PACKAGES_FILE))))
        throw new Error('Run mise run test integration or mise run test e2e first.');
    const registry = resources.use(await createNpmRegistry(work.path, { packages: [] }));
    resources.use(
        overrideEnvironment({
            GSPOT_TEST_NPM_REGISTRY: registry.url,
            NPM_CONFIG_USERCONFIG: registry.npmrc,
        }),
    );
    const paths = await readFile(join(folder, TOOL_PATHS_FILE), 'utf8');
    const pinnedToolsPath = paths.trim().split(/\r?\n/u);
    const commandFolder = dirname(join(folder, GSPOT_LAUNCHER_PATH));
    resources.use(
        overrideEnvironment({
            PATH: [
                commandFolder,
                ...pinnedToolsPath,
                join(testModules, '.bin'),
                join(workspaceModules, '.bin'),
                readEnvironmentVariable('PATH') ?? '',
            ].join(delimiter),
        }),
    );
} catch (error) {
    await resources.disposeAsync();
    throw error;
}
