// Packs packages, serves their registry, and installs sandbox tool projects.
import { z } from 'zod';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { isWindows } from '#tests/setup/system.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { installNpmTools } from '#cli/tools/npm/project.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import type { SandboxSettings } from '#tests/types/sandbox.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { runGspot, spawnGspot } from '#tests/setup/run-gspot.ts';
import { installPythonTools } from '#cli/tools/python/project.ts';
import { prepareLockfiles } from '#cli/tools/project-lockfiles.ts';
import { selectLockfileName } from '#cli/tools/npm/tool-project.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { testModules, installedModules } from '#tests/setup/modules.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import type { LockedInputs, ToolProjectFiles } from '#tests/types/packages.ts';
import { open, mkdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';
import { MISE_TRUST, PINNED_TOOLS_FILE, TEST_RUN_FOLDER_NAME } from '#tests/data/test-setup.ts';

/** Give real hook repositories the same authored runtime pins as this repository. */
async function installRuntimes(root: string): Promise<void> {
    const runtimeSettings: unknown = parse(await readFile(join(import.meta.dir, '../..', PINNED_TOOLS_FILE), 'utf8'));
    const { tools } = z.object({ tools: z.object({ bun: z.string(), node: z.string() }) }).parse(runtimeSettings);
    await writeFile(join(root, PINNED_TOOLS_FILE), stringify({ tools }));
    const trusted = await runCommand([...MISE_TRUST, PINNED_TOOLS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

/** Resolve the installed test package executables before system tools. */
function buildToolsPath(): string {
    return [join(testModules, '.bin'), join(installedModules, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(
        delimiter,
    );
}

/** Return the folder that holds the current test run's packages and tool paths. */
function testRunFolder(): string {
    return join(tmpdir(), TEST_RUN_FOLDER_NAME);
}

/** Resolve the integration preload command before installed tools. */
function buildSandboxPath(): string {
    const folder = testRunFolder();
    return [join(folder, 'bin'), buildToolsPath()].join(delimiter);
}

/** Initialize a sandbox and install the tools selected for its integration tests. */
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
    await runSandboxStep(root, ['install'], environment, 'install');
}

/** Run a public setup step and report its captured output when it fails. */
async function runSandboxStep(
    root: string,
    commandArguments: string[],
    environment: Record<string, string>,
    step: string,
): Promise<void> {
    const result = await spawnGspot(root, commandArguments, environment);
    if (result.code !== 0) throw new Error(`Sandbox ${step} failed: ${result.stdout}${result.stderr}`);
}

/** Generate the sandbox's tool files and install its tools through the public CLI commands. */
async function installToolProjects(root: string): Promise<void> {
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    const installed = await spawnGspot(root, ['install']);
    if (installed.code !== 0) throw new Error(`Sandbox install failed: ${installed.stdout}${installed.stderr}`);
}

/** Check that a refused install reports its reason before making another registry request. */
async function captureInstallRefusal(
    root: string,
    tools: Iterable<ToolDeclaration>,
    registry: { readonly requests: number },
): Promise<{ message: string; requests: number }> {
    using owner = openWriter(root);
    const session = await openSession(root);
    const requests = registry.requests;
    const installation =
        owner.files.read('.gspot/package.json') === undefined
            ? installPythonTools(buildInstallContext(session, owner), 'uv')
            : installNpmTools({ ...buildInstallContext(session, owner), tools: [...tools] });
    return { message: await captureRejection(installation), requests: registry.requests - requests };
}

/** Resolve and write the selected project inputs before exercising locked installation. */
async function writeLockedInputs(root: string, suppliedLog?: Writer): Promise<LockedInputs> {
    using resources = new DisposableStack();
    const applied = await runGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    const session = await openSession(root);
    const generated = generate(session);
    const log = suppliedLog ?? resources.use(openWriter(root));
    if (log.files.read('.gspot/mise.toml') !== undefined) {
        const trusted = await runCommand(['mise', 'trust', '.gspot/mise.toml'], { cwd: root });
        if (trusted.code !== 0) throw new Error(`Sandbox tool trust failed: ${trusted.stdout}${trusted.stderr}`);
    }
    await prepareLockfiles(buildInstallContext(session, log), generated.files);
    writeGeneratedFiles(session, generated, log);
    const client = session.getPackageManager();
    const inputs = client === undefined ? undefined : await readToolProjectFiles(root, client.name);
    const lockfilePath = join(root, '.gspot/uv.lock');
    return {
        session,
        ...(inputs === undefined ? {} : { inputs }),
        ...(log.files.read('.gspot/pyproject.toml') === undefined
            ? {}
            : {
                  manifest: await readFile(join(root, '.gspot/pyproject.toml')),
                  lockfilePath,
                  lockfile: await readFile(lockfilePath),
              }),
    };
}

/** Link the installed TypeScript package and its executable launchers. */
async function installCompiler(root: string, folder = join(root, 'node_modules')): Promise<string> {
    await mkdir(folder, { recursive: true });
    const kind = isWindows ? 'junction' : 'dir';
    await symlink(await realpath(join(testModules, 'typescript')), join(folder, 'typescript'), kind);
    await symlink(await realpath(join(testModules, '.bin')), join(folder, '.bin'), kind);
    return [join(folder, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter);
}

/** Captures the generated manifest, lockfile, and ownership bytes before an installation journey. */
async function readToolProjectFiles(root: string, packageManager: PackageManager['name']): Promise<ToolProjectFiles> {
    const lockfilePath = join(root, '.gspot', selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        manifest: await readFile(join(root, '.gspot/package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
    };
}

/**
 * Build the install state from an open sandbox session and its repository writer.
 * @param session the open sandbox session.
 * @param writer the locked sandbox writer.
 * @returns generated inputs, selected tools, and an empty install command log.
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
    writeLockedInputs,
    installToolProjects,
    buildInstallContext,
    readToolProjectFiles,
    captureInstallRefusal,
};
