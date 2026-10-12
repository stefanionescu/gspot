// Bun preloads this module in each isolated integration and end-to-end test file.
// Installs the pinned tools and packed commands for the integration and e2e suites.
import { testdir } from 'testdirs';
import { afterAll } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { miseFile } from '#cli/generation/mise.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { CLI_MAIN } from '#tests/setup/run-gspot.ts';
import { runCommand } from '#tests/setup/processes.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { useEnvironment } from '#tests/setup/environment.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { pinOf, collectPins } from '#cli/configurations/tool-pins.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { toolsPath, packPackages, createNpmRegistry } from '#tests/setup/install.ts';

import {
    MISE_TRUST,
    MISE_INSTALL,
    MISE_BIN_PATHS,
    TERMINATED_EXIT,
    INTERRUPTED_EXIT,
    PINNED_TOOLS_FILE,
} from '#tests/config/integration.ts';

const resources = new AsyncDisposableStack();
const controller = new AbortController();
const root = join(import.meta.dir, '../..');
const work = resources.use(await testdir());
const stop = (code: number): void => {
    process.exitCode = code;
    controller.abort();
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
    resources.use(useEnvironment({ GSPOT_TEST_RUN_FOLDER: work.path }));
    await packPackages(
        work.path,
        [
            { ...eslintPluginPackage, source: join(root, 'packages/eslint-plugin') },
            { ...cliPackage, source: join(root, 'packages/cli') },
        ],
        runCommand,
    );
    const registry = resources.use(await createNpmRegistry(work.path, { declarations: [], execute: runCommand }));
    resources.use(
        useEnvironment({
            GSPOT_TEST_NPM_REGISTRY: registry.url,
            GSPOT_TEST_NPMRC: registry.npmrc,
            NPM_CONFIG_USERCONFIG: registry.npmrc,
        }),
    );
    const pinnedToolsPath = await installPinnedTools(work.path, controller.signal);
    const commandFolder = await fakeTool(
        work.path,
        'bin/gspot',
        `await import(${JSON.stringify(pathToFileURL(CLI_MAIN).href)});\n`,
    );
    resources.use(useEnvironment({ PATH: [commandFolder, ...pinnedToolsPath, toolsPath()].join(delimiter) }));
} catch (error) {
    await resources.disposeAsync();
    throw error;
}

/** Install the program pins once for integration and end-to-end suites. */
async function installPinnedTools(folder: string, cancelSignal: AbortSignal): Promise<string[]> {
    const config = join(folder, PINNED_TOOLS_FILE);
    const manifests = [...configurationManifests().values()];
    const names = collectPins(manifests)
        .filter((tool) => tool.system !== true && hasToolBuild(tool.name))
        .flatMap((tool) => pinOf(tool)?.name ?? []);
    await writeFile(config, miseFile(manifests).content);
    for (const argv of [
        [...MISE_TRUST, config],
        [...MISE_INSTALL, ...names],
    ]) {
        const result = await runCommand(argv, {
            cwd: folder,
            cancelSignal,
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS, ...names], { cwd: folder, cancelSignal });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(/\r?\n/u);
}
