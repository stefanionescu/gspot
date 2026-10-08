import { testdir } from 'testdirs';
import { join, dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { misePins } from '#cli/configurations/pins.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildSandboxPath } from '#tests/harness/install.ts';
import { createPackageRegistry } from '#tests/harness/registry.ts';
import type { Quickstart } from '#tests/types/harness/quickstart.ts';
import { sourceLauncherDirectory } from '#tests/harness/environment.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * Prepare native tutorial state with the suite's installed tools and packed CLI.
 * @param root the tutorial's working directory
 * @returns owned Mise state and registry settings, without installing tools
 */
export async function prepareQuickstart(root: string): Promise<Quickstart> {
    await using resources = new AsyncDisposableStack();
    const state = resources.use(await testdir());
    const registry = resources.use(
        await createPackageRegistry(state.path, { declarations: [], execute: runTestCommand }),
    );
    const npmrc = join(state.path, '.npmrc');
    await writeFile(npmrc, `@gspothq:registry=${registry.url}/\n`, { mode: 0o600 });
    const environment = {
        PATH: buildSandboxPath([]),
        MISE_CONFIG_DIR: join(state.path, 'config'),
        MISE_DATA_DIR: join(state.path, 'data'),
        MISE_STATE_DIR: join(state.path, 'state'),
        MISE_CACHE_DIR: join(state.path, 'cache'),
        MISE_CEILING_PATHS: dirname(root),
        NPM_CONFIG_USERCONFIG: npmrc,
    };
    const installedPaths = await Promise.all(
        misePins([...configurationManifests().values()])
            .filter((pin) => hasToolBuild(pin.name))
            .map(async (pin) => {
                const requirement = `${pin.name}@${pin.version}`;
                const installed = await runTestCommand(
                    pin.name === 'uv' ? ['mise', 'which', 'uv'] : ['mise', 'where', requirement],
                    { cwd: sourceLauncherDirectory },
                );
                if (installed.code !== 0)
                    throw new Error(`The suite has no ${requirement}: ${installed.stdout}${installed.stderr}`);
                return {
                    requirement,
                    path: pin.name === 'uv' ? dirname(installed.stdout.trim()) : installed.stdout.trim(),
                };
            }),
    );
    for (const { requirement, path } of installedPaths) {
        const linked = await runTestCommand(['mise', 'link', requirement, path], { cwd: root, env: environment });
        if (linked.code !== 0) throw new Error(`Tutorial tool linking failed: ${linked.stdout}${linked.stderr}`);
    }
    const ownership = resources.move();
    return {
        environment,
        async [Symbol.asyncDispose]() {
            await ownership.disposeAsync();
        },
    };
}
