// Installs sandbox tools and runtimes and prepares locked tool projects.
import { z } from 'zod';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { isWindows } from '#tests/setup/system.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import type { InstallContext } from '#cli/types/install.ts';
import type { SandboxSettings } from '#tests/types/sandbox.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { selectLockfileName } from '#cli/tools/npm/tool-project.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { testModules, installedModules } from '#tests/setup/modules.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { open, mkdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';
import { MISE_TRUST, PINNED_TOOLS_FILE, TEST_RUN_FOLDER_NAME } from '#tests/data/test-setup.ts';

/** Give a hook repository the Bun and Node pins of this repository; a clone keeps its committed file. */
async function installRuntimes(root: string): Promise<void> {
    if (!(await Bun.file(join(root, PINNED_TOOLS_FILE)).exists())) {
        const runtimeSettings: unknown = parse(
            await readFile(join(import.meta.dir, '../..', PINNED_TOOLS_FILE), 'utf8'),
        );
        const { tools } = z.object({ tools: z.object({ bun: z.string(), node: z.string() }) }).parse(runtimeSettings);
        await writeFile(join(root, PINNED_TOOLS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, PINNED_TOOLS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

/** A `PATH` that puts the installed test package programs before system tools. */
function buildToolsPath(): string {
    return [join(testModules, '.bin'), join(installedModules, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(
        delimiter,
    );
}

/** The folder that holds the packages and tool paths of this test run. */
function testRunFolder(): string {
    return join(tmpdir(), TEST_RUN_FOLDER_NAME);
}

/** A `PATH` with the test run launcher first, then the installed tools. */
function buildSandboxPath(): string {
    const folder = testRunFolder();
    return [join(folder, 'bin'), buildToolsPath()].join(delimiter);
}

/** Run init in a sandbox, set its level and configurations, and install its tools. */
async function installSandbox(
    root: string,
    commandArguments: string[],
    environment: Record<string, string>,
    settings: SandboxSettings = {},
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>,
): Promise<void> {
    await runSandboxStep(root, commandArguments, environment, 'init');
    if (settings.level !== undefined)
        await runSandboxStep(root, ['set', 'level', settings.level], environment, 'level');
    for (const configuration of settings.without ?? []) {
        await runSandboxStep(root, ['remove', configuration], environment, 'remove');
    }
    await prepare?.(root, environment);
    if (settings.install !== false) await runSandboxStep(root, ['install'], environment, 'install');
}

/** Run one gspot command in a sandbox and throw with its output when it fails. */
async function runSandboxStep(
    root: string,
    commandArguments: string[],
    environment: Record<string, string>,
    step: string,
): Promise<void> {
    const result = await spawnGspot(root, commandArguments, environment);
    if (result.code !== 0) throw new Error(`Sandbox ${step} failed: ${result.stdout}${result.stderr}`);
}

/** Run apply and install in a sandbox. */
async function installToolProjects(root: string): Promise<void> {
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    const installed = await spawnGspot(root, ['install']);
    if (installed.code !== 0) throw new Error(`Sandbox install failed: ${installed.stdout}${installed.stderr}`);
}

/** Link the installed TypeScript package and its executable launchers. */
async function installCompiler(root: string, folder = join(root, 'node_modules')): Promise<string> {
    await mkdir(folder, { recursive: true });
    const kind = isWindows ? 'junction' : 'dir';
    await symlink(await realpath(join(testModules, 'typescript')), join(folder, 'typescript'), kind);
    await symlink(await realpath(join(testModules, '.bin')), join(folder, '.bin'), kind);
    return [join(folder, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter);
}

/** Read a tool project file, its lockfile, and the lockfile mode. */
async function readToolProjectFiles(
    root: string,
    packageManager: PackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const python = packageManager === 'uv';
    const lockfilePath = join(root, '.gspot', python ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        manifest: await readFile(join(root, '.gspot', python ? 'pyproject.toml' : 'package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
    };
}

/**
 * Build the install state for a sandbox.
 * @param session the open sandbox.
 * @param writer holds the repository lock and saves files.
 * @returns the install state.
 */
function buildInstallContext(session: Session, writer: Writer): InstallContext {
    return {
        session,
        writer,
        generated: generate(session),
        tools: listDistinctTools(session.neededToolManifests),
        mise: null,
        steps: [],
    };
}

export {
    testRunFolder,
    runSandboxStep,
    installSandbox,
    installRuntimes,
    installCompiler,
    buildSandboxPath,
    installToolProjects,
    buildInstallContext,
    readToolProjectFiles,
};
