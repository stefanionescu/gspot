// Installs the packed npm packages in isolated projects.
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/processes.ts';
import type { PackedSandbox } from '#tests/types/e2e.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { NPM_INSTALL_FLAGS, OFFLINE_ENVIRONMENT } from '#tests/config/e2e.ts';
import { sep, join, resolve, relative, delimiter, isAbsolute } from 'node:path';
import { environmentVariable, buildSpawnEnvironment } from '#cli/system/environment.ts';

const root = join(import.meta.dir, '../..');
const inherited = { ...buildSpawnEnvironment() };
/** An installed npm package runs with the user's paths and no source module overrides. */
export const packedEnvironment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (environmentVariable(inherited, 'PATH') ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(root, resolve(entry));
            return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
        })
        .join(delimiter),
};

/** Install the packed CLI as a user installs it into a new project. */
export async function createPackedSandbox(npmrc: string): Promise<PackedSandbox> {
    const directory = await testdir();
    try {
        const root = join(directory.path, 'sandbox');
        await mkdir(root);
        await writeFile(join(root, 'package.json'), '{"name":"sandbox","private":true}\n');
        const onlineOptions = {
            cwd: root,
            env: { ...packedEnvironment, NPM_CONFIG_USERCONFIG: npmrc, NO_COLOR: '1', CI: '1' },
        };
        const installed = await runCommand(
            ['npm', 'install', `@gspothq/cli@${packageManifest.version}`, ...NPM_INSTALL_FLAGS],
            onlineOptions,
        );
        if (installed.code !== 0)
            throw new Error(`Packed CLI installation failed: ${installed.stdout}${installed.stderr}`);
        return {
            root,
            workspace: directory.path,
            command: ['node', join(root, 'node_modules/@gspothq/cli/dist/gspot.js')],
            onlineOptions,
            offlineOptions: { ...onlineOptions, env: { ...onlineOptions.env, ...OFFLINE_ENVIRONMENT } },
            [Symbol.asyncDispose]: directory[Symbol.asyncDispose].bind(directory),
        };
    } catch (error) {
        await directory[Symbol.asyncDispose]();
        throw error;
    }
}

/** Initialize and install the configurations selected by a packed CLI test. */
export async function setUpPackedSandbox(
    installation: PackedSandbox,
    options: { cwd: string; configurations: readonly string[]; level?: 'recommended' | 'all' },
): Promise<SpawnResult> {
    const commandOptions = { ...installation.onlineOptions, cwd: options.cwd };
    const initialized = await runCommand(
        [...installation.command, 'init', '--yes', '--configurations', ...options.configurations, '--json'],
        commandOptions,
    );
    if (initialized.code !== 0) throw new Error(`Packed CLI init failed: ${initialized.stdout}${initialized.stderr}`);
    if (options.level !== undefined) {
        const level = await runCommand([...installation.command, 'set', 'level', options.level], commandOptions);
        if (level.code !== 0) throw new Error(`Packed CLI level failed: ${level.stdout}${level.stderr}`);
    }
    const installed = await runCommand([...installation.command, 'install', '--json'], commandOptions);
    if (installed.code !== 0) throw new Error(`Packed CLI tools failed: ${installed.stdout}${installed.stderr}`);
    return initialized;
}
