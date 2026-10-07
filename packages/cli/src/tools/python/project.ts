import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { parse, stringify } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { readText } from '#cli/platform/source.ts';
import { buildLockFile } from '#cli/tools/locks.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { readInstalledTree } from '#cli/tools/installed-files.ts';
import { installationDiagnostics } from '#cli/tools/diagnostics.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { PYTHON_MIN_VERSION } from '#cli/config/parsers/packages.ts';
import { assertCredentialFreeLock } from '#cli/tools/credentials.ts';
import { pyprojectSchema } from '#cli/parsers/schema/python/tools.ts';
import { MODE_BITS, PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { pythonLockMatches, parsePythonSettings } from '#cli/parsers/python/tools.ts';
import type { LockDrift, ToolOwner, LockPreparation } from '#cli/types/tools/install.ts';
import { UV_LOCK, DOT_GSPOT, TOOL_PYTHON_PROJECT } from '#cli/config/platform/locations.ts';
import type { PythonToolInputs, PythonPreparation, PythonInstallationPlan } from '#cli/types/tools/python.ts';
import { chmodSync, lstatSync, unlinkSync, copyFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

import {
    UV_MISE_PIN,
    UV_ACQUISITION,
    UV_LOCK_ARGUMENTS,
    UV_VENV_ARGUMENTS,
    UV_INSTALL_ARGUMENTS,
} from '#cli/config/tools/python.ts';

/**
 * Copy repository uv index settings into the scratch folder, make relative paths absolute, and collect registry credentials.
 * @param root the repository root.
 * @param work the directory the resolution runs in.
 * @returns index credentials that must remain absent from generated lock files.
 */
function writePythonSettings(root: string, work: string): string[] {
    const { settings, credentials } = parsePythonSettings(root, {
        uv: readText(root, 'uv.toml'),
        project: readText(root, 'pyproject.toml'),
    });
    if (Object.keys(settings).length > 0)
        writeFileSync(join(work, 'uv.toml'), stringify(settings), { mode: PRIVATE_FILE });
    return credentials;
}

// A temporary lock must not publish credentials supplied through repository index settings.
function readPythonLock(work: string, credentials: string[]): string {
    const lock = readFileSync(join(work, 'uv.lock'), 'utf8');
    assertCredentialFreeLock(
        lock,
        credentials,
        new GspotError(
            'installation',
            'The uv lock includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
        ),
    );
    const project = readFileSync(join(work, 'pyproject.toml'), 'utf8');
    if (!pythonLockMatches(project, lock))
        throw new GspotError(
            'installation',
            'The uv lock does not match the tool project. Existing files were preserved.',
        );
    return lock;
}

// uv always runs inside its temporary project and cannot download an interpreter.
async function runUv(
    work: string,
    args: readonly string[],
    executable: string,
    credentials: string[],
): Promise<SpawnResult> {
    const result = await runTool(
        [executable, ...args, '--project', work, '--directory', work, '--no-python-downloads'],
        {
            cwd: work,
            env: { UV_PROJECT_ENVIRONMENT: join(work, '.venv'), UV_VENV_RELOCATABLE: 'true', UV_LINK_MODE: 'copy' },
        },
    );
    if (result.code === 0) readPythonLock(work, credentials);
    return result;
}

// Detach the host interpreter link and verify the copied environment before writing.
async function relocateInterpreter(work: string): Promise<void> {
    // uv links the host interpreter. Copy its executable so the written environment has no external link.
    const interpreter = environmentExecutable(join(work, '.venv'), 'python');
    const source = realpathSync(interpreter);
    const mode = lstatSync(source).mode & MODE_BITS;
    if (lstatSync(interpreter).isSymbolicLink()) {
        unlinkSync(interpreter);
        copyFileSync(source, interpreter);
        chmodSync(interpreter, mode);
    }
    const read = await runTool([interpreter, '-c', 'import sys, ssl; assert sys.prefix != sys.base_prefix'], {
        cwd: work,
    });
    if (read.code !== 0)
        throw new GspotError(
            'installation',
            'The Python interpreter cannot run from a copied environment. No installed files were written. Run: gspot install',
        );
}

// Lock, sync, and relocate the environment in a scratch folder, then install it once its inputs are unchanged.
async function installInWork(
    root: string,
    owner: ToolOwner,
    work: string,
    inputs: PythonToolInputs,
    executable: string,
): Promise<void> {
    const { project, lock } = inputs;
    writeFileSync(join(work, 'pyproject.toml'), project.bytes);
    writeFileSync(join(work, 'uv.lock'), lock.bytes);
    const credentials = writePythonSettings(root, work);
    for (const args of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        const result = await runUv(work, args, executable, credentials);
        if (result.missing)
            throw new GspotError('tool', `uv is unavailable. Run: ${UV_ACQUISITION}, then gspot install.`);
        if (result.code !== 0)
            throw new GspotError(
                'installation',
                `UV ${args[0]} failed (exit ${String(result.code)}). Python ${PYTHON_MIN_VERSION} or newer must be installed because interpreter downloads are disabled. Check Python and index settings, then run: gspot install.\n${installationDiagnostics(result, credentials)}`,
            );
    }
    if (
        !readFileSync(join(work, 'pyproject.toml')).equals(project.bytes) ||
        !readFileSync(join(work, 'uv.lock')).equals(lock.bytes)
    )
        throw new GspotError('installation', `The uv run changed locked inputs. ${SETUP}`);
    await relocateInterpreter(work);
    if (!isDeepStrictEqual(owner.read(TOOL_PYTHON_PROJECT), project) || !isDeepStrictEqual(owner.read(UV_LOCK), lock))
        throw new GspotError('installation', 'Python tool inputs changed during installation. Retry the command.');
    owner.installTree('python', readInstalledTree(join(work, '.venv'), 'python'));
}

/**
 * Resolve Python tool requirements outside the repository before writing generated files.
 * Appends the successfully prepared lock to files.
 * @param preparation the repository root and command-owned installer.
 * @param files the generated files, among them the Python tool project.
 *
 * @param owner the lifecycle owner that records the lock.
 * @param options the caller's lock preparation request.
 * @param options.refreshLocks resolve from declared pins without reusing the recorded lock.
 */
export async function preparePythonProject(
    preparation: PythonPreparation,
    files: GeneratedFile[],
    owner: Pick<ToolOwner, 'read'>,
    { refreshLocks }: LockPreparation,
): Promise<void> {
    const { root } = preparation;
    const project = files.find((file) => file.path === TOOL_PYTHON_PROJECT);
    if (project === undefined) return;
    pyprojectSchema.parse(parse(project.content));
    const original = owner.read(UV_LOCK);
    let content = refreshLocks ? undefined : original?.bytes.toString('utf8');
    if (!pythonLockMatches(project.content, content)) {
        using workFolder = scratchFolder('gspot-python-lock-');
        const work = workFolder.path;
        writeFileSync(join(work, 'pyproject.toml'), project.content);
        const credentials = writePythonSettings(root, work);
        const result = await runUv(work, UV_LOCK_ARGUMENTS, await preparation.pythonInstaller(), credentials);
        if (result.missing)
            throw new GspotError('tool', `uv is unavailable. Run: ${UV_ACQUISITION}, then rerun the command.`);
        if (result.code !== 0)
            throw new GspotError(
                'installation',
                `UV lock failed (exit ${String(result.code)}). Python ${PYTHON_MIN_VERSION} or newer must be installed because interpreter downloads are disabled. Check Python and index settings, then rerun the command.\n${installationDiagnostics(result, credentials)}`,
            );
        content = readFileSync(join(work, 'uv.lock'), 'utf8');
    }
    files.push(buildLockFile(UV_LOCK, content, original));
}

/**
 * Read Python lock drift without resolving dependencies or creating ownership state.
 * @param root the repository root.
 * @param generated the generated files, among them the Python tool project.
 * @returns the lock path with what is wrong with it, or undefined when there is no Python tool project.
 */
export function pythonLockDrift(root: string, generated: GeneratedFile[]): LockDrift | undefined {
    const project = generated.find((file) => file.path === TOOL_PYTHON_PROJECT);
    if (project === undefined) return undefined;
    using files = openRoot(root);
    const lock = files.read(UV_LOCK);
    if (lock === undefined) return { path: UV_LOCK, kind: 'missing' };
    return pythonLockMatches(project.content, lock.bytes.toString('utf8'))
        ? { path: UV_LOCK }
        : { path: UV_LOCK, kind: 'changed' };
}

/**
 * Plan the uv installation, lock resolution, and locked Python environment.
 * @param root the repository root.
 * @param proposed the generated Python tool project, when previewing uncommitted output.
 * @param runner the configured task runner.
 * @param options the caller's lock preparation request.
 * @param options.refreshLocks include fresh resolution even when the recorded pins match.
 * @returns commands for each phase, or empty phases without a Python tool project.
 */
export function pythonInstallationPlan(
    root: string,
    proposed: string | undefined,
    runner: string | undefined,
    { refreshLocks }: LockPreparation,
): PythonInstallationPlan {
    using files = openRoot(root);
    const project = proposed ?? files.read(TOOL_PYTHON_PROJECT)?.bytes.toString('utf8');
    if (project === undefined) return { installer: [], lock: [], environment: [] };
    pyprojectSchema.parse(parse(project));
    const recorded = files.read(UV_LOCK);
    return {
        installer: runner === 'mise' ? [['mise', 'install', UV_MISE_PIN]] : [],
        lock:
            refreshLocks || !pythonLockMatches(project, recorded?.bytes.toString('utf8'))
                ? [['uv', ...UV_LOCK_ARGUMENTS, '--project', DOT_GSPOT]]
                : [],
        environment: [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS].map((args) => ['uv', ...args, '--project', DOT_GSPOT]),
    };
}

/**
 * Install locked Python tools in a scratch folder, then write the environment to .gspot/.venv.
 * @param root the repository root.
 * @param owner the lifecycle owner that records the writes.
 * @param executable the uv executable to run.
 * @returns the line that says what was installed, or '' without a Python tool project.
 */
export async function installPythonProject(root: string, owner: ToolOwner, executable: string): Promise<string> {
    const project = owner.read(TOOL_PYTHON_PROJECT);
    if (project === undefined) return '';
    pyprojectSchema.parse(parse(project.bytes.toString('utf8')));
    const lock = owner.read(UV_LOCK);
    if (lock === undefined || !pythonLockMatches(project.bytes.toString('utf8'), lock.bytes.toString('utf8')))
        throw new GspotError('installation', SETUP);
    using workFolder = scratchFolder('gspot-python-install-');
    const work = workFolder.path;
    await installInWork(root, owner, work, { project, lock }, executable);
    return 'installed locked Python tools under .gspot/.venv';
}
