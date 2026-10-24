import { join } from 'node:path';
import { format } from 'prettier';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll } from 'bun:test';
import { JSON_INDENT } from '#cli/config/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { Level } from '#cli/types/configurations.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { planReplacement } from '#cli/apply/write/plans.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { openWriter, writePlans } from '#cli/apply/write/writer.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PROSE_SANDBOX } from '#tests/config/checks/general/prose.ts';
import { linkPackages } from '#tests/setup/sandboxes/node-modules.ts';
import { readCheckoutCacheFolder } from '#cli/checks/language/swift/cache.ts';
import { VALE_PACKAGES } from '#cli/config/generation/configurations/general/prose.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { type Sandbox, type SandboxPlan, type InstalledSandboxPlan } from '#tests/types/sandbox.ts';
import { runGspot, spawnGspot, runGspotStep, buildInitArguments } from '#tests/setup/cli/commands.ts';

import {
    REGISTRY_HOST,
    ZIP_FILE_OPTIONS,
    SANDBOX_GITIGNORE,
    VALE_PACKAGE_FILES,
    SANDBOX_PACKAGE_JSON,
} from '#tests/config/setup/sandboxes.ts';

/**
Name the installed npm in the root package.json, as a repository at level all must.

@param root the sandbox folder with a package.json.
*/
export async function pinSandboxNpm(root: string): Promise<void> {
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
    const folder = resources.use(await testdir());
    resources.defer(() => rm(readCheckoutCacheFolder(folder.path), { recursive: true, force: true }));
    await writeSandbox(folder.path, plan);
    await plan.before?.(folder.path);
    commitAll(folder.path);
    await writeFile(
        join(folder.path, 'gspot.toml'),
        buildSandboxSettings([...plan.configurations], { level: plan.level ?? 'all' }),
    );
    await plan.prepare?.(folder.path);
    const owned = resources.move();
    return {
        root: folder.path,
        run: runGspot,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

async function prepareInstalledSandbox(root: string, plan: InstalledSandboxPlan): Promise<void> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkPackages(join(root, 'node_modules'), Object.keys(plan.dependencies));
    await plan.before?.(root);
    commitAll(root);
    await initSandbox(
        { root, run: spawnGspot },
        {
            configurations: plan.configurations,
            without: [...(plan.without ?? [])],
            level: plan.level ?? 'all',
            ...(plan.install === false && { install: false }),
            prepare: plan.prepare,
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
        const folder = resources.use(await testdir());
        resources.defer(() => rm(readCheckoutCacheFolder(folder.path), { recursive: true, force: true }));
        await prepareInstalledSandbox(folder.path, plan);
        sandbox = {
            root: folder.path,
            run: spawnGspot,
        };
    });
    afterAll(() => resources.disposeAsync());
    return () => sandbox;
}

/**
Share a prose sandbox whose Vale packages come from the local package server.
*/
export function shareProseSandbox(): () => Sandbox {
    const resources = new DisposableStack();
    let server: ReturnType<typeof Bun.serve>;
    beforeAll(() => {
        const archive = zipSync(
            Object.fromEntries(
                Object.entries(VALE_PACKAGE_FILES).map(([path, content]) => [
                    path,
                    [strToU8(content), ZIP_FILE_OPTIONS.regular],
                ]),
            ),
        );
        server = resources.use(Bun.serve({ hostname: REGISTRY_HOST, port: 0, fetch: () => new Response(archive) }));
    });
    function pointValePackages(root: string): void {
        const packages = VALE_PACKAGES.map((name) => `http://${REGISTRY_HOST}:${String(server.port)}/${name}.zip`).join(
            ', ',
        );
        using writer = openWriter(root);
        const file = writer.read(GSPOT_PATHS.valeConfigFile) as FileContents;
        const observed = [
            planReplacement(writer, {
                path: GSPOT_PATHS.valeConfigFile,
                next: {
                    bytes: Buffer.from(
                        file.bytes.toString('utf8').replace(/^Packages = .*$/mu, () => `Packages = ${packages}`),
                    ),
                    mode: 0o444,
                },
            }),
        ];
        writePlans(writer, observed);
    }
    const sandbox = shareInstalledSandbox({
        ...PROSE_SANDBOX,
        prepare: pointValePackages,
    });
    afterAll(() => {
        resources.dispose();
    });
    return () => ({
        ...sandbox(),
        async run(root, commandArguments) {
            const result = await spawnGspot(root, commandArguments);
            if (commandArguments[0] === 'apply' && result.code === 0) pointValePackages(root);
            return result;
        },
    });
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
        prepare?: SandboxPlan['prepare'];
    },
): Promise<ProcessOutput> {
    const initialized = await runGspotStep(sandbox, buildInitArguments([...options.configurations], { json: true }));
    if (options.level !== undefined) await runGspotStep(sandbox, ['set', 'level', options.level]);
    const excluded = options.without ?? [];
    for (const configuration of excluded)
        await runGspotStep(sandbox, [
            'remove',
            configuration,
            '--reason',
            'The sandbox exercises selected checks without this configuration.',
        ]);
    await options.prepare?.(sandbox.root);
    if (options.install !== false) await runGspotStep(sandbox, ['install']);
    return initialized;
}
