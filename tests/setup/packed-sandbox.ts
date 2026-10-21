// Installs the packed npm packages in isolated projects.
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/processes.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import type { PackedSandbox } from '#tests/types/packages.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { sep, join, resolve, relative, delimiter, isAbsolute } from 'node:path';
import { NPM_INSTALL_FLAGS, OFFLINE_ENVIRONMENT } from '#tests/data/test-setup.ts';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

const root = join(import.meta.dir, '../..');

const inherited = { ...buildSpawnEnvironment() };

/** An installed npm package runs with the user's paths and no source module overrides. */
export const packedEnvironment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (readEnvironmentVariable('PATH') ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(root, resolve(entry));
            return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
        })
        .join(delimiter),
};

/** Install the packed CLI as a user installs it into a new project. */
export async function createPackedSandbox(): Promise<PackedSandbox> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    const root = join(folder.path, 'sandbox');
    await mkdir(root);
    await writeFile(join(root, 'package.json'), '{"name":"sandbox","private":true}\n');
    const onlineOptions = {
        cwd: root,
        env: { ...packedEnvironment, NO_COLOR: '1', CI: '1' },
    };
    const installed = await runCommand(
        ['npm', 'install', `@gspothq/cli@${packageManifest.version}`, ...NPM_INSTALL_FLAGS],
        onlineOptions,
    );
    if (installed.code !== 0) throw new Error(`Packed CLI installation failed: ${installed.stdout}${installed.stderr}`);
    const owned = resources.move();
    return {
        root,
        workspace: folder.path,
        command: ['node', join(root, 'node_modules/@gspothq/cli/dist/gspot.js')],
        onlineOptions,
        offlineOptions: { ...onlineOptions, env: { ...onlineOptions.env, ...OFFLINE_ENVIRONMENT } },
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

/** Run init with these configurations, set the level, and install, with the packed CLI. */
export async function setUpPackedSandbox(
    installation: PackedSandbox,
    options: { cwd: string; configurations: readonly string[]; level?: 'recommended' | 'all' },
): Promise<ProcessOutput> {
    const sandbox: Sandbox = {
        root: options.cwd,
        environment: {},
        run: async (cwd, commandArguments) =>
            await runCommand([...installation.command, ...commandArguments], { ...installation.onlineOptions, cwd }),
    };
    const initialized = await runSandboxStep(sandbox, [
        'init',
        '--yes',
        '--configurations',
        ...options.configurations,
        '--json',
    ]);
    if (options.level !== undefined) await runSandboxStep(sandbox, ['set', 'level', options.level]);
    await runSandboxStep(sandbox, ['install', '--json']);
    return initialized;
}
