// Bun starts each file's registry and reuses the prepared packages and tools.
import { testdir } from 'testdirs';
import { afterAll } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/files.ts';
import { join, dirname, delimiter } from 'node:path';
import { TEST_RUN_FOLDER } from '#tests/setup/install.ts';
import { stopOnSignals } from '#tests/setup/processes.ts';
import { createNpmRegistry } from '#tests/setup/registry.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { testModules, installedModules } from '#tests/setup/modules.ts';
import { TOOL_PATHS_FILE, GSPOT_LAUNCHER_PATH, PACKED_PACKAGES_FILE } from '#tests/data/test-setup.ts';

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
                join(installedModules, '.bin'),
                readEnvironmentVariable('PATH') ?? '',
            ].join(delimiter),
        }),
    );
} catch (error) {
    await resources.disposeAsync();
    throw error;
}
