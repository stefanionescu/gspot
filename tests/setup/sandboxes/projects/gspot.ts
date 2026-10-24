import { testdir } from 'testdirs';
import { isInside } from '#cli/system/paths.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { GspotProject } from '#tests/types/packages.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { join, resolve, relative, delimiter } from 'node:path';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import { applyEnvironment } from '#tests/setup/system/environment.ts';
import { GSPOT_ENVIRONMENT, OFFLINE_ENVIRONMENT } from '#tests/config/setup/environment.ts';

export const isolatedEnvironment: Record<string, string | undefined> = {
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (readEnvironmentVariable('PATH') ?? '')
        .split(delimiter)
        .filter((folder) => !isInside(relative(REPOSITORY_ROOT, resolve(folder))))
        .join(delimiter),
};

/**
Install gspot from the local registry into a new project, as a user installs it.
*/
export async function createGspotProject(): Promise<GspotProject> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    const root = join(folder.path, 'sandbox');
    await mkdir(root);
    await writeFile(join(root, 'package.json'), '{"name":"sandbox","private":true}\n');
    runGitStep(root, ['init', '--quiet']);
    const environment = { ...GSPOT_ENVIRONMENT, PATH: isolatedEnvironment['PATH'] ?? '' };
    const installed = await runCommand(
        ['npm', 'install', `${cliPackage.name}@${cliPackage.version}`, ...NPM_INSTALL_FLAGS],
        {
            cwd: root,
            env: { ...isolatedEnvironment, ...GSPOT_ENVIRONMENT },
        },
    );
    if (installed.code !== 0) throw new Error(`Installing gspot failed: ${installed.stdout}${installed.stderr}`);
    const command = ['node', join(root, 'node_modules', cliPackage.name, cliPackage.bin.gspot)];
    const buildSandbox = (changes: Readonly<Record<string, string | undefined>>): Sandbox => {
        const sandboxEnvironment = { ...environment };
        applyEnvironment(sandboxEnvironment, changes);
        return {
            root,
            run: (cwd, commandArguments) =>
                runCommand([...command, ...commandArguments], {
                    cwd,
                    env: { ...isolatedEnvironment, ...changes, ...sandboxEnvironment },
                }),
        };
    };
    const owned = resources.move();
    return {
        root,
        workspace: folder.path,
        environment,
        buildSandbox,
        online: buildSandbox({}),
        offline: buildSandbox(OFFLINE_ENVIRONMENT),
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
