// Installs the packed npm packages in isolated projects.
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/processes.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { PackedSandbox } from '#tests/types/packages.ts';
import { sep, join, resolve, relative, delimiter, isAbsolute } from 'node:path';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';
import { NPM_INSTALL_FLAGS, GSPOT_ENVIRONMENT, OFFLINE_ENVIRONMENT } from '#tests/data/test-setup.ts';

const repositoryRoot = join(import.meta.dir, '../..');

/** An installed npm package runs with the user's paths and no source module overrides. */
export const packedEnvironment: Record<string, string | undefined> = {
    ...buildSpawnEnvironment(),
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (readEnvironmentVariable('PATH') ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(repositoryRoot, resolve(entry));
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
    const sourceEnvironment: Record<string, string | undefined> = { ...packedEnvironment, ...GSPOT_ENVIRONMENT };
    const environment: Record<string, string> = {};
    for (const [name, value] of Object.entries(sourceEnvironment)) {
        if (value !== undefined) environment[name] = value;
    }
    const offlineEnvironment = { ...environment };
    for (const [name, value] of Object.entries(OFFLINE_ENVIRONMENT)) {
        if (value === undefined) Reflect.deleteProperty(offlineEnvironment, name);
        else offlineEnvironment[name] = value;
    }
    const installed = await runCommand(['npm', 'install', `@gspothq/cli@${cliPackage.version}`, ...NPM_INSTALL_FLAGS], {
        cwd: root,
        env: { ...packedEnvironment, ...environment },
    });
    if (installed.code !== 0) throw new Error(`Packed CLI installation failed: ${installed.stdout}${installed.stderr}`);
    const command = ['node', join(root, 'node_modules/@gspothq/cli/dist/gspot.js')];
    const owned = resources.move();
    return {
        root,
        workspace: folder.path,
        online: {
            root,
            environment,
            run: (cwd, commandArguments, environment) =>
                runCommand([...command, ...commandArguments], { cwd, env: { ...packedEnvironment, ...environment } }),
        },
        offline: {
            root,
            environment: offlineEnvironment,
            run: (cwd, commandArguments, environment) =>
                runCommand([...command, ...commandArguments], {
                    cwd,
                    env: { ...packedEnvironment, ...OFFLINE_ENVIRONMENT, ...environment },
                }),
        },
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
