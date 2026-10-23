// Creates sandboxes: temporary repositories with gspot settings for one test or one test file.
import { join } from 'node:path';
import { format } from 'prettier';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll } from 'bun:test';
import { JSON_INDENT } from '#cli/config/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { Level } from '#cli/types/configurations.ts';
import { planReplacement } from '#cli/apply/write-plans.ts';
import { openWriter, writePlans } from '#cli/apply/writer.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PROSE_SANDBOX } from '#tests/config/checks/general/prose.ts';
import { linkPackages } from '#tests/setup/sandboxes/node-modules.ts';
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
 * Name the installed npm in the root package.json, as a repository at level all must.
 *
 * @param root the sandbox folder with a package.json.
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

/** Write the files, package.json, and tsconfig.json of a sandbox. */
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
        // The format configuration checks every tracked file, so the tsconfig.json has the layout Prettier writes.
        ...(plan.tsconfig === undefined
            ? {}
            : {
                  'tsconfig.json': await format(JSON.stringify(plan.tsconfig), {
                      parser: 'json',
                      tabWidth: JSON_INDENT,
                      printWidth: SETTING_DEFINITIONS['format.print_width'].default,
                  }),
              }),
        ...plan.files,
    });
    if (plan.dependencies !== undefined) await pinSandboxNpm(root);
}

/** Build one isolated sandbox whose commands run in the current process. */
export async function createSandbox(plan: SandboxPlan): Promise<Sandbox & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    await writeSandbox(folder.path, plan);
    await plan.before?.(folder.path);
    commitAll(folder.path);
    await writeFile(
        join(folder.path, 'gspot.toml'),
        buildSandboxSettings([...plan.configurations], { level: plan.level ?? 'all' }),
    );
    await plan.prepare?.(folder.path, {});
    const owned = resources.move();
    return {
        root: folder.path,
        environment: {},
        run: runGspot,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

/** Run init in a sandbox and install the tools of one integration test file. */
export async function prepareInstalledSandbox(
    root: string,
    plan: InstalledSandboxPlan,
): Promise<Record<string, string>> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkPackages(join(root, 'node_modules'), Object.keys(plan.dependencies));
    await plan.before?.(root);
    commitAll(root);
    await initSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            configurations: plan.configurations,
            without: [...(plan.without ?? [])],
            level: plan.level ?? 'all',
            ...(plan.install === false ? { install: false } : {}),
            prepare: plan.prepare,
        },
    );
    return {};
}

/** Share a sandbox after installing its tools once for the current test file. */
export function shareInstalledSandbox(plan: InstalledSandboxPlan): () => Sandbox {
    const resources = new AsyncDisposableStack();
    let sandbox: Sandbox;
    beforeAll(async () => {
        const folder = resources.use(await testdir());
        const environment = await prepareInstalledSandbox(folder.path, plan);
        sandbox = {
            root: folder.path,
            environment,
            run: spawnGspot,
        };
    });
    afterAll(() => resources.disposeAsync());
    return () => sandbox;
}

/** Share a prose sandbox whose Vale packages come from the local package server. */
export function shareProseSandbox(): () => Sandbox {
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
        server = Bun.serve({ hostname: REGISTRY_HOST, port: 0, fetch: () => new Response(archive) });
    });
    function pointValePackages(root: string): void {
        const packages = VALE_PACKAGES.map((name) => `http://${REGISTRY_HOST}:${String(server.port)}/${name}.zip`).join(
            ', ',
        );
        using writer = openWriter(root);
        const file = writer.files.read(GSPOT_PATHS.valeConfigFile) as FileContents;
        writePlans(writer, [
            planReplacement(writer, {
                path: GSPOT_PATHS.valeConfigFile,
                next: {
                    bytes: Buffer.from(
                        file.bytes.toString('utf8').replace(/^Packages = .*$/mu, `Packages = ${packages}`),
                    ),
                    mode: 0o444,
                },
            }),
        ]);
    }
    const sandbox = shareInstalledSandbox({
        ...PROSE_SANDBOX,
        prepare: pointValePackages,
    });
    afterAll(async () => {
        await server.stop(true);
    });
    return () => ({
        ...sandbox(),
        async run(root, commandArguments, environment) {
            const result = await spawnGspot(root, commandArguments, environment);
            if (commandArguments[0] === 'apply' && result.code === 0) pointValePackages(root);
            return result;
        },
    });
}

/** Run init in a sandbox, set its level and configurations, and install its tools. */
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
    for (const configuration of options.without ?? [])
        await runGspotStep(sandbox, [
            'remove',
            configuration,
            '--reason',
            'The sandbox exercises selected checks without this configuration.',
        ]);
    await options.prepare?.(sandbox.root, sandbox.environment);
    if (options.install !== false) await runGspotStep(sandbox, ['install']);
    return initialized;
}
