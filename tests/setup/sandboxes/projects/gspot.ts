import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { isInside } from '#cli/system/paths.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { GspotProject } from '#tests/types/setup.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { join, resolve, relative, delimiter } from 'node:path';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { REPOSITORY_ROOT, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { GSPOT_ENVIRONMENT, OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { LINE_BREAK, TOOL_PATHS_FILE, NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';

const testToolFolders = new Set(readFileSync(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), 'utf8').split(LINE_BREAK));

// The packed gspot installs its own tools, so the test tools and the source launcher stay off its PATH.
export const isolatedEnvironment: Record<string, string | undefined> = {
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (readEnvironmentVariable('PATH') ?? '')
        .split(delimiter)
        .filter(
            (folder) =>
                !testToolFolders.has(folder) &&
                [REPOSITORY_ROOT, TEST_RUN_FOLDER].every((root) => !isInside(relative(root, resolve(folder)))),
        )
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
    const owned = resources.move();
    return {
        root,
        workspace: folder.path,
        environment,
        online: {
            root,
            run: (cwd, commandArguments) =>
                runCommand([...command, ...commandArguments], { cwd, env: { ...isolatedEnvironment, ...environment } }),
        },
        offline: {
            root,
            run: (cwd, commandArguments) =>
                runCommand([...command, ...commandArguments], {
                    cwd,
                    env: { ...isolatedEnvironment, ...environment, ...OFFLINE_ENVIRONMENT },
                }),
        },
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}
