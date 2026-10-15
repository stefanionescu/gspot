// Bun preloads this module in each isolated integration and end-to-end test file.
// Starts each file's registry and reuses the prepared packages and program tools.
import { testdir } from 'testdirs';
import { afterAll } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, dirname, delimiter } from 'node:path';
import { runCommand } from '#tests/setup/processes.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { toolsPath, testRunFolder, createNpmRegistry } from '#tests/setup/install.ts';

import {
    TERMINATED_EXIT,
    TOOL_PATHS_FILE,
    INTERRUPTED_EXIT,
    GSPOT_LAUNCHER_PATH,
    PACKED_PACKAGES_FILE,
} from '#tests/config/integration.ts';

const resources = new AsyncDisposableStack();
const work = resources.use(await testdir());
const stop = (code: number): void => {
    process.exitCode = code;
    resources.disposeAsync().catch((error: unknown) => {
        process.stderr.write(`${String(error)}\n`);
        process.exitCode = 1;
    });
};
const interrupt = (): void => {
    stop(INTERRUPTED_EXIT);
};
const terminate = (): void => {
    stop(TERMINATED_EXIT);
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', terminate);
afterAll(async () => {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
    await resources.disposeAsync();
});
try {
    const folder = testRunFolder();
    if (!(await Bun.file(join(folder, PACKED_PACKAGES_FILE)).exists()))
        throw new Error('Run mise run test:integration or mise run test:e2e first.');
    const registry = resources.use(await createNpmRegistry(work.path, { declarations: [], execute: runCommand }));
    resources.use(
        useEnvironment({
            GSPOT_TEST_NPM_REGISTRY: registry.url,
            GSPOT_TEST_NPMRC: registry.npmrc,
            NPM_CONFIG_USERCONFIG: registry.npmrc,
        }),
    );
    const paths = await readFile(join(folder, TOOL_PATHS_FILE), 'utf8');
    const pinnedToolsPath = paths.trim().split(/\r?\n/u);
    const commandFolder = dirname(join(folder, GSPOT_LAUNCHER_PATH));
    resources.use(useEnvironment({ PATH: [commandFolder, ...pinnedToolsPath, toolsPath()].join(delimiter) }));
} catch (error) {
    await resources.disposeAsync();
    throw error;
}
