// Installs sandbox tools and runtimes and prepares locked tool projects.
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, delimiter } from 'node:path';
import { isOnDisk } from '#tests/setup/files.ts';
import type { Session } from '#cli/types/session.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { DIGEST_ALGORITHM } from '#cli/config/text.ts';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { Level } from '#cli/types/configurations.ts';
import { FOLDER_LINK_TYPE } from '#tests/setup/system.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildInitArguments } from '#tests/setup/builders.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { testModules, linkPackages } from '#tests/setup/modules.ts';
import type { Sandbox, SandboxPlan } from '#tests/types/sandbox.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { selectLockfileName } from '#cli/install/npm/tool-project.ts';
import { runtimeSettingsSchema } from '#tests/schemas/preparation.ts';
import { listDistinctTools } from '#cli/configurations/declared-tools.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';
import { open, mkdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';
import { MISE_TRUST, PINNED_TOOLS_FILE, TEST_RUN_FOLDER_NAME, TEST_RUN_HASH_LENGTH } from '#tests/data/test-setup.ts';

/**
 * Read this checkout's validated Bun and Node pins.
 *
 * @returns the two pinned runtime versions.
 */
export async function readRuntimePins(): Promise<{ bun: string; node: string }> {
    const runtimeSettings: unknown = parse(await readFile(join(import.meta.dir, '../..', PINNED_TOOLS_FILE), 'utf8'));
    return runtimeSettingsSchema.parse(runtimeSettings).tools;
}

/** Give a hook repository the Bun and Node pins of this repository; a clone keeps its committed file. */
export async function installRuntimes(root: string): Promise<void> {
    if (!(await isOnDisk(join(root, PINNED_TOOLS_FILE)))) {
        const tools = await readRuntimePins();
        await writeFile(join(root, PINNED_TOOLS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, PINNED_TOOLS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

const repositoryRoot = join(import.meta.dir, '../..');

/** The packages and tool paths of the test run for this checkout. */
export const TEST_RUN_FOLDER = join(
    tmpdir(),
    `${TEST_RUN_FOLDER_NAME}-${createHash(DIGEST_ALGORITHM).update(repositoryRoot).digest('hex').slice(0, TEST_RUN_HASH_LENGTH)}`,
);

/** Run init in a sandbox, set its level and configurations, and install its tools. */
export async function installSandbox(
    sandbox: Sandbox,
    options: {
        configurations: readonly string[];
        level?: Level;
        without?: readonly string[];
        install?: false;
        prepare?: SandboxPlan['prepare'];
    },
): Promise<ProcessOutput> {
    const initialized = await runSandboxStep(sandbox, buildInitArguments([...options.configurations], { json: true }));
    if (options.level !== undefined) await runSandboxStep(sandbox, ['set', 'level', options.level]);
    for (const configuration of options.without ?? [])
        await runSandboxStep(sandbox, [
            'remove',
            configuration,
            '--reason',
            'The sandbox exercises selected checks without this configuration.',
        ]);
    await options.prepare?.(sandbox.root, sandbox.environment);
    if (options.install !== false) await runSandboxStep(sandbox, ['install']);
    return initialized;
}

/** Run one gspot command in a sandbox and throw with its output when it fails. */
export async function runSandboxStep(sandbox: Sandbox, commandArguments: readonly string[]): Promise<ProcessOutput> {
    const result = await sandbox.run(sandbox.root, commandArguments, sandbox.environment);
    if (result.code !== 0) {
        const message = `gspot ${commandArguments.join(' ')} failed in ${sandbox.root}:\n${result.stdout}${result.stderr}`;
        throw new Error(message);
    }
    return result;
}

/** Run apply and install in a sandbox. */
export async function installToolProjects(root: string): Promise<void> {
    const sandbox = { root, environment: {}, run: spawnGspot };
    await runSandboxStep(sandbox, ['apply']);
    await runSandboxStep(sandbox, ['install']);
}

/** Link the installed TypeScript package and its executable launchers. */
export async function installCompiler(root: string, folder = join(root, 'node_modules')): Promise<string> {
    await mkdir(folder, { recursive: true });
    await linkPackages(folder, ['typescript']);
    await symlink(await realpath(join(testModules, '.bin')), join(folder, '.bin'), FOLDER_LINK_TYPE);
    return [join(folder, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter);
}

/** Read a tool project file, its lockfile, and the lockfile mode. */
export async function readToolProjectFiles(
    root: string,
    packageManager: PackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const python = packageManager === 'uv';
    const lockfilePath = join(root, '.gspot', python ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        projectFile: await readFile(join(root, '.gspot', python ? 'pyproject.toml' : 'package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
    };
}

/**
 * Build the install state for a sandbox.
 *
 * @param session the open sandbox.
 * @param writer holds the repository lock and saves files.
 * @returns the install state.
 */
export function buildToolInstall(session: Session, writer: Writer): ToolInstall {
    return {
        session,
        writer,
        generated: generate(session),
        tools: listDistinctTools(session.neededToolConfigurations),
        misePath: null,
        steps: [],
    };
}
