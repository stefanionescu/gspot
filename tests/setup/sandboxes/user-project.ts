// Creates a new project where npm installs gspot from the local registry, as a user does.
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import type { UserProject } from '#tests/types/packages.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import { sep, join, resolve, relative, delimiter, isAbsolute } from 'node:path';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';
import { GSPOT_ENVIRONMENT, OFFLINE_ENVIRONMENT } from '#tests/config/setup/environment.ts';

const repositoryRoot = join(import.meta.dir, '../../..');

/** An installed npm package runs with the user's paths and no source module overrides. */
export const userEnvironment: Record<string, string | undefined> = {
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
export async function createUserProject(): Promise<UserProject> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    const root = join(folder.path, 'sandbox');
    await mkdir(root);
    await writeFile(join(root, 'package.json'), '{"name":"sandbox","private":true}\n');
    const sourceEnvironment: Record<string, string | undefined> = { ...userEnvironment, ...GSPOT_ENVIRONMENT };
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
        env: { ...userEnvironment, ...environment },
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
                runCommand([...command, ...commandArguments], { cwd, env: { ...userEnvironment, ...environment } }),
        },
        offline: {
            root,
            environment: offlineEnvironment,
            run: (cwd, commandArguments, environment) =>
                runCommand([...command, ...commandArguments], {
                    cwd,
                    env: { ...userEnvironment, ...OFFLINE_ENVIRONMENT, ...environment },
                }),
        },
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
