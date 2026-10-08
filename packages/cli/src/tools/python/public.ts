import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { GspotError } from '#cli/platform/public.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { readText } from '#cli/platform/root/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { ToolProject } from '#cli/types/tools/project.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { pythonInstallerPin } from '#cli/configurations/public.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { PYTHON_MIN_VERSION } from '#cli/config/parsers/packages.ts';
import { MODE_BITS, PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { pythonToolProjectSchema } from '#cli/parsers/schema/public.ts';
import type { PythonExecution, PythonPreparation } from '#cli/types/tools/python.ts';
import { parsePythonSettings, pythonLockfileMatches } from '#cli/tools/python/contracts.ts';
import { DOT_GSPOT, UV_LOCKFILE, TOOL_PYTHON_PROJECT } from '#cli/config/platform/locations.ts';
import { runTool, installationDiagnostics, assertCredentialFreeLockfile } from '#cli/tools/contracts.ts';
import { UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS, UV_LOCKFILE_ARGUMENTS } from '#cli/config/tools/python.ts';
import { chmodSync, lstatSync, unlinkSync, copyFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

/**
 * Copy repository uv index settings into the scratch folder, make relative paths absolute, and collect registry credentials.
 * @param root the repository root.
 * @param work the directory the resolution runs in.
 * @returns index credentials that must remain absent from generated lockfiles.
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

// A temporary lockfile must not publish credentials supplied through repository index settings.
function readPythonLockfile(work: string, credentials: string[]): string {
    const lockfile = readFileSync(join(work, 'uv.lock'), 'utf8');
    assertCredentialFreeLockfile(
        lockfile,
        credentials,
        new GspotError(
            'installation',
            'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
        ),
    );
    const project = readFileSync(join(work, 'pyproject.toml'), 'utf8');
    if (!pythonLockfileMatches(project, lockfile))
        throw new GspotError(
            'installation',
            'The uv lockfile does not match the tool project. Existing files were preserved.',
        );
    return lockfile;
}

// uv always runs inside its temporary project and cannot download an interpreter.
async function runUv(
    work: string,
    args: readonly string[],
    executable: string,
    credentials: string[],
    cancelSignal: AbortSignal | undefined,
): Promise<SpawnResult> {
    const result = await runTool(
        [executable, ...args, '--project', work, '--directory', work, '--no-python-downloads'],
        {
            cwd: work,
            cancelSignal,
            env: { UV_PROJECT_ENVIRONMENT: join(work, '.venv'), UV_VENV_RELOCATABLE: 'true', UV_LINK_MODE: 'copy' },
        },
    );
    cancelSignal?.throwIfAborted();
    if (result.code === 0) readPythonLockfile(work, credentials);
    return result;
}

// Detach the host interpreter link and verify the copied environment before writing.
async function relocateInterpreter(work: string, cancelSignal: AbortSignal | undefined): Promise<void> {
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
        cancelSignal,
    });
    cancelSignal?.throwIfAborted();
    if (read.code !== 0)
        throw new GspotError(
            'installation',
            'The Python interpreter cannot run from a copied environment. No installed files were written. Run: gspot install',
        );
}

/** The Python project's native commands and validations for the shared tool-project flow. */
export const pythonToolProject: ToolProject<string, PythonPreparation, PythonExecution> = {
    manifestPath: TOOL_PYTHON_PROJECT,
    kind: 'python',
    additionalPaths: [],
    lockPrefix: 'gspot-python-lockfile-',
    installPrefix: 'gspot-python-install-',
    parse: (manifest) => {
        pythonToolProjectSchema.parse(parse(manifest));
        return manifest;
    },
    lockfilePath: () => UV_LOCKFILE,
    matches: pythonLockfileMatches,
    current: (project, recorded) => (pythonLockfileMatches(project, recorded) ? recorded : undefined),
    commands: (_project, runner) => {
        const uv = pythonInstallerPin();
        return {
            installer: runner === 'mise' ? [['mise', 'install', `${uv.name}@${uv.version}`]] : [],
            lockfile: [['uv', ...UV_LOCKFILE_ARGUMENTS, '--project', DOT_GSPOT]],
            environment: [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS].map((args) => [
                'uv',
                ...args,
                '--project',
                DOT_GSPOT,
            ]),
        };
    },
    createLockfile: async (work, preparation) => {
        const credentials = writePythonSettings(preparation.root, work);
        const executable = await preparation.pythonInstaller(preparation.cancelSignal);
        const result = await runUv(work, UV_LOCKFILE_ARGUMENTS, executable, credentials, preparation.cancelSignal);
        if (result.missing)
            throw new GspotError(
                'tool',
                `uv is unavailable. Run: python -m pip install uv==${pythonInstallerPin().version}, then rerun the command.`,
            );
        if (result.code !== 0)
            throw new GspotError(
                'installation',
                `UV lock failed (exit ${String(result.code)}). Python ${PYTHON_MIN_VERSION} or newer must be installed because interpreter downloads are disabled. Check Python and index settings, then rerun the command.\n${installationDiagnostics(result, credentials)}`,
            );
        return readPythonLockfile(work, credentials);
    },
    install: async (work, { root, executable, cancelSignal }, guards) => {
        const credentials = writePythonSettings(root, work);
        for (const args of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
            const result = await runUv(work, args, executable, credentials, cancelSignal);
            if (result.missing)
                throw new GspotError(
                    'tool',
                    `uv is unavailable. Run: python -m pip install uv==${pythonInstallerPin().version}, then gspot install.`,
                );
            if (result.code !== 0)
                throw new GspotError(
                    'installation',
                    `UV ${args[0]} failed (exit ${String(result.code)}). Python ${PYTHON_MIN_VERSION} or newer must be installed because interpreter downloads are disabled. Check Python and index settings, then run: gspot install.\n${installationDiagnostics(result, credentials)}`,
                );
        }
        guards.scratch(`The uv run changed locked inputs. ${SETUP}`);
        await relocateInterpreter(work, cancelSignal);
        guards.source('Python tool inputs changed during installation. Retry the command.');
        return 'installed locked Python tools under .gspot/.venv';
    },
};

/**
 * Resolve uv through the selected runner before a temporary project uses it.
 * @param root the repository root for runner configuration
 * @param runner the explicitly selected task runner, if any
 * @param cancelSignal the command cancellation
 * @returns the uv executable used for both lockfile creation and installation
 */
export async function installUv(
    root: string,
    runner: string | undefined,
    cancelSignal: AbortSignal | undefined,
): Promise<string> {
    if (runner !== 'mise') return 'uv';
    const uv = pythonInstallerPin();
    const pin = `${uv.name}@${uv.version}`;
    const installed = await runTool(['mise', 'install', pin], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (installed.missing) throw new GspotError('tool', 'mise is unavailable. Install mise, then rerun the command.');
    if (installed.code !== 0)
        throw new GspotError(
            'installation',
            `mise did not install ${pin}. Run mise install ${pin} and read its error.
${installationDiagnostics(installed, [])}`,
        );
    const located = await runTool(['mise', 'which', 'uv', '--tool', pin], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (located.code !== 0 || located.stdout.trim() === '')
        throw new GspotError(
            'tool',
            `Cannot locate ${pin}. Run: mise install ${pin}, then rerun the command.
${installationDiagnostics(located, [])}`,
        );
    return located.stdout.trim();
}

/**
 * Run a pinned Python check over the scope's installed project dependencies.
 * @param selection the scope's selected tool declarations
 * @param scopeRoot the native project folder
 * @param command the target executable and its arguments
 * @returns the uv project command without synchronizing the project or its lockfile
 */
export function pythonProjectCommand(
    selection: ScopeSelection,
    scopeRoot: string,
    command: [string, ...string[]],
): string[] {
    const tool = toolPin(selection.selected, command[0]);
    const packagePin = tool.installers['pypi'];
    if (packagePin?.version === undefined)
        throw new GspotError('tool', `The ${tool.name} check has no pinned Python package declaration.`);
    return [
        'uv',
        'run',
        '--no-sync',
        '--project',
        scopeRoot,
        '--with',
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}
