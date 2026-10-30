import { join } from 'node:path';
import { format } from 'prettier';
import { afterAll, beforeAll } from 'bun:test';
import { JSON_INDENT } from '#cli/config/text.ts';
import { testdir, createFileTree } from 'testdirs';
import type { Level } from '#cli/types/manifests.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkPackages } from '#tests/setup/sandboxes/node-modules.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { runGspot, spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { SANDBOX_GITIGNORE, SANDBOX_PACKAGE_JSON } from '#tests/config/setup/sandboxes.ts';
import { type Sandbox, type SandboxPlan, type InstalledSandboxPlan } from '#tests/types/sandbox.ts';

async function pinSandboxNpm(root: string): Promise<void> {
    const npm = await runCommand(['npm', '--version'], { cwd: root });
    const path = join(root, 'package.json');
    const packageJson = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    await writeFile(
        path,
        JSON.stringify({ ...packageJson, packageManager: `npm@${npm.stdout.trim()}` }, null, JSON_INDENT) + '\n',
    );
}

async function writeSandbox(root: string, plan: SandboxPlan): Promise<void> {
    const json: Record<string, string> = {};
    if (plan.json !== undefined)
        for (const [path, value] of Object.entries(plan.json))
            json[path] = await format(JSON.stringify(value), {
                parser: 'json',
                tabWidth: JSON_INDENT,
                printWidth: SETTING_DEFINITIONS['format.print_width'].default,
            });
    await createFileTree(root, {
        '.gitignore': SANDBOX_GITIGNORE,
        ...(plan.dependencies !== undefined && {
            'package.json':
                JSON.stringify({ ...SANDBOX_PACKAGE_JSON, dependencies: plan.dependencies }, null, JSON_INDENT) + '\n',
        }),
        ...json,
        ...plan.files,
    });
    if (plan.dependencies !== undefined) await pinSandboxNpm(root);
}

/**
Build one isolated sandbox whose commands run in the current process.
*/
export async function createSandbox(plan: SandboxPlan): Promise<Sandbox & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    const { path: root } = resources.use(await testdir());
    await writeSandbox(root, plan);
    commitAll(root);
    for (const path of plan.executable ?? []) await markExecutable(root, path);
    await writeFile(
        join(root, SETTINGS_FILE),
        buildSandboxSettings([...plan.configurations], { level: plan.level ?? 'all' }),
    );
    const owned = resources.move();
    return {
        root,
        run: runGspot,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

async function prepareInstalledSandbox(root: string, plan: InstalledSandboxPlan): Promise<void> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkPackages(join(root, 'node_modules'), Object.keys(plan.dependencies));
    for (const command of plan.commands ?? []) {
        const result = await runCommand([...command], { cwd: root });
        if (result.code !== 0) throw new Error(`${command.join(' ')} failed: ${result.stdout}${result.stderr}`);
    }
    commitAll(root);
    await initSandbox(
        { root, run: spawnGspot },
        {
            configurations: plan.configurations,
            without: [...(plan.without ?? [])],
            level: plan.level ?? 'all',
            ...(plan.install === false && { install: false }),
        },
    );
}

/**
Share a sandbox after installing its tools once for the current test file.
*/
export function shareInstalledSandbox(plan: InstalledSandboxPlan): () => Sandbox {
    const resources = new AsyncDisposableStack();
    let sandbox: Sandbox;
    beforeAll(async () => {
        const { path: root } = resources.use(await testdir());
        await prepareInstalledSandbox(root, plan);
        sandbox = { root, run: spawnGspot };
    });
    afterAll(() => resources.disposeAsync());
    return () => sandbox;
}

/**
Run init in a sandbox, set its level and configurations, and install its tools.
*/
export async function initSandbox(
    sandbox: Sandbox,
    options: {
        configurations: readonly string[];
        level?: Level;
        without?: readonly string[];
        install?: false;
    },
): Promise<ProcessOutput> {
    const initialized = await runGspotStep(sandbox, [
        'init',
        '--yes',
        '--configurations',
        ...options.configurations,
        '--json',
    ]);
    if (options.level !== undefined) await runGspotStep(sandbox, ['set', 'level', options.level]);
    const excluded = options.without ?? [];
    for (const configuration of excluded)
        await runGspotStep(sandbox, [
            'remove',
            configuration,
            '--reason',
            'The sandbox exercises selected checks without this configuration.',
        ]);
    if (options.install !== false) await runGspotStep(sandbox, ['install']);
    return initialized;
}
