// Creates shared or isolated repositories for check samples.
import { join } from 'node:path';
import { afterAll, beforeAll } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { JSON_INDENT } from '#tests/config/formatting.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { runGspot, spawnGspot } from '#tests/setup/run-gspot.ts';
import { sandboxPath, initRepository } from '#tests/setup/install.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';
import { SANDBOX_GITIGNORE, SANDBOX_PACKAGE_JSON } from '#tests/config/sandbox.ts';
import type { Sandbox, SandboxPlan, RuntimeDetectionRow, InstalledSandboxPlan } from '#tests/types/sandbox.ts';

/** Write the source and dependency declarations owned by a sandbox. */
async function writeSandbox(root: string, plan: SandboxPlan): Promise<void> {
    await createFileTree(root, {
        '.gitignore': SANDBOX_GITIGNORE,
        ...(plan.dependencies === undefined
            ? {}
            : {
                  'package.json':
                      JSON.stringify({ ...SANDBOX_PACKAGE_JSON, dependencies: plan.dependencies }, null, JSON_INDENT) +
                      '\n',
              }),
        ...(plan.tsconfig === undefined
            ? {}
            : { 'tsconfig.json': JSON.stringify(plan.tsconfig, null, JSON_INDENT) + '\n' }),
        ...plan.files,
    });
}

/** Build one isolated sandbox and run its checks in the current process. */
export async function createSandbox(plan: SandboxPlan): Promise<Sandbox> {
    const directory = await testdir();
    try {
        await writeSandbox(directory.path, plan);
        await plan.before?.(directory.path);
        commitAll(directory.path);
        await Bun.write(
            join(directory.path, 'gspot.toml'),
            settingsText([...plan.configurations], { level: plan.level ?? 'all' }),
        );
        await plan.prepare?.(directory.path, {});
        return {
            root: directory.path,
            environment: {},
            run: runGspot,
            [Symbol.asyncDispose]: directory[Symbol.asyncDispose].bind(directory),
        };
    } catch (error) {
        await directory[Symbol.asyncDispose]();
        throw error;
    }
}

/** Initialize and install the tools used by one integration test file. */
export async function prepareInstalledSandbox(
    root: string,
    plan: InstalledSandboxPlan,
): Promise<Record<string, string>> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkInstalledModules(join(root, 'node_modules'));
    await plan.before?.(root);
    commitAll(root);
    const environment = { PATH: sandboxPath() };
    await initRepository(root, buildInitArguments([...plan.configurations]), environment, {
        without: [...(plan.without ?? [])],
        level: plan.level ?? 'all',
    });
    await plan.prepare?.(root, environment);
    return environment;
}

/** Share a sandbox after installing its tools once for the current test file. */
export function shareInstalledSandbox(plan: InstalledSandboxPlan): () => Sandbox {
    const resources = new AsyncDisposableStack();
    let sandbox: Sandbox;
    beforeAll(async () => {
        const directory = resources.use(await testdir());
        const environment = await prepareInstalledSandbox(directory.path, plan);
        sandbox = {
            root: directory.path,
            environment,
            run: spawnGspot,
            [Symbol.asyncDispose]: directory[Symbol.asyncDispose].bind(directory),
        };
    });
    afterAll(() => resources.disposeAsync());
    return () => sandbox;
}

export function runtimeDetectionRows(): RuntimeDetectionRow[] {
    return [
        ...JAVASCRIPT_RUNTIMES.flatMap((runtime) => [
            {
                name: `${runtime} engine`,
                runtime,
                package: { engines: { [runtime]: '>=1' } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} script`,
                runtime,
                package: { scripts: { start: `${runtime} run entry.js` } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} shebang`,
                runtime,
                package: {},
                source: `#!/usr/bin/env ${runtime}\nconsole.log(1);\n`,
                detected: true,
            },
            {
                name: `${runtime} quoted script text`,
                runtime,
                package: { scripts: { start: `echo "${runtime} entry.js"` } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} type dependency`,
                runtime,
                package: { devDependencies: { [`@types/${runtime}`]: '1.0.0' } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} tool-project manifest`,
                runtime,
                package: {},
                source: '',
                toolProjectManifest: { engines: { [runtime]: '>=1' } },
                detected: false,
            },
        ]),
        {
            name: 'JavaScript without a declared runtime',
            runtime: 'node',
            package: {},
            source: 'console.log(1);\n',
            detected: false,
        },
    ];
}
