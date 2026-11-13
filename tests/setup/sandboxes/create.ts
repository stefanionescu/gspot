import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll } from 'bun:test';
import { format } from 'prettier';
import { createFileTree, testdir } from 'testdirs';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import type { Level } from '#cli/types/settings.ts';
import { runGspot, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkPackages } from '#tests/setup/sandboxes/node-modules.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { InstalledSandboxPlan, ProcessOutput, Sandbox, SandboxPlan } from '#tests/types/setup.ts';

const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;

const SANDBOX_GITIGNORE = 'node_modules\n';

const SANDBOX_REMOVAL_REASON = 'The sandbox exercises selected checks without this configuration.';

async function pinSandboxNpm(root: string): Promise<void> {
    const npm = await runCommand(['npm', '--version'], { cwd: root });
    const path = join(root, 'package.json');
    const packageJson = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    const manifest = { ...packageJson, packageManager: `npm@${npm.stdout.trim()}` };
    await writeFile(path, `${JSON.stringify(manifest, null, JSON_INDENT)}\n`);
}

async function writeSandbox(root: string, plan: SandboxPlan): Promise<void> {
    const json: Record<string, string> = {};
    if (plan.json !== undefined)
        for (const [path, value] of Object.entries(plan.json))
            json[path] = await format(JSON.stringify(value), {
                parser: 'json',
                tabWidth: JSON_INDENT,
                printWidth: formatSchema.shape.print_width.parse(undefined),
            });
    await createFileTree(root, {
        '.gitignore': SANDBOX_GITIGNORE,
        ...(plan.dependencies !== undefined && {
            'package.json': `${JSON.stringify({ ...SANDBOX_PACKAGE_JSON, dependencies: plan.dependencies }, null, JSON_INDENT)}\n`,
        }),
        ...json,
        ...plan.files,
    });
    if (plan.dependencies !== undefined) await pinSandboxNpm(root);
}

async function writeUninstalledSandbox(root: string, plan: InstalledSandboxPlan): Promise<void> {
    const removed = (plan.without ?? []).map((name) => `${name} = ${JSON.stringify(SANDBOX_REMOVAL_REASON)}\n`);
    const tables = `[format]\nindent_width = ${String(JSON_INDENT)}\nquotes = "single"\n${
        removed.length === 0 ? '' : `[removed_configurations]\n${removed.join('')}`
    }`;
    await writeFile(
        join(root, SETTINGS_FILE),
        buildSandboxSettings([...plan.configurations], { level: plan.level ?? 'all', rules: true, tables }),
    );
    commitAll(root);
    await applyGeneratedFiles(root);
}

async function prepareInstalledSandbox(root: string, plan: InstalledSandboxPlan): Promise<void> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkPackages(join(root, 'node_modules'), Object.keys(plan.dependencies));
    const commands = plan.commands ?? [];
    for (const command of commands) {
        const result = await runCommand([...command], { cwd: root });
        if (result.code !== 0) throw new Error(`${command.join(' ')} failed: ${result.stdout}${result.stderr}`);
    }
    if (plan.install === false) {
        await writeUninstalledSandbox(root, plan);
        return;
    }
    await writeFile(
        join(root, '.prettierrc.json'),
        JSON.stringify({
            tabWidth: JSON_INDENT,
            printWidth: formatSchema.shape.print_width.parse(undefined),
            singleQuote: true,
        }),
    );
    commitAll(root);
    await initSandbox(
        { root, run: spawnGspot },
        {
            configurations: plan.configurations,
            without: [...(plan.without ?? [])],
            level: plan.level ?? 'all',
        },
    );
}

export async function createSandbox(plan: SandboxPlan): Promise<Sandbox & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    const { path: root } = resources.use(await testdir());
    await writeSandbox(root, plan);
    commitAll(root);
    const executable = plan.executable ?? [];
    for (const path of executable) await markExecutable(root, path);
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

export async function initSandbox(
    sandbox: Sandbox,
    options: {
        configurations: readonly string[];
        level?: Level;
        without?: readonly string[];
    },
): Promise<ProcessOutput> {
    const configurations =
        options.configurations.length === 0
            ? ['--configurations', 'gspot']
            : options.configurations.flatMap((configuration) => ['--configurations', configuration]);
    const level = options.level === undefined ? [] : ['--level', options.level];
    const initialized = await runGspotStep(sandbox, ['init', ...configurations, ...level, '--json']);
    const excluded = options.without ?? [];
    for (const configuration of excluded)
        await runGspotStep(sandbox, ['remove', configuration, '--reason', SANDBOX_REMOVAL_REASON]);
    if (excluded.length > 0) await runGspotStep(sandbox, ['install']);
    return initialized;
}
