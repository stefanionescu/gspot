import { join } from 'node:path';
import { getTool } from '#cli/manifests/tools.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT_FOLDER_NAME } from '#cli/config/tools/programs.ts';
import { buildPythonProjectTable } from '#cli/tools/projects.ts';
import { findRepositoryPython } from '#cli/tools/programs/mise.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { formatUnavailableNote } from '#cli/tools/programs/inspect.ts';
import { writeUvSettings } from '#cli/tools/installers/python/indexes.ts';
import { UV_LOCKFILE, PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import type { UvCommand, ToolInstall, GeneratedFile } from '#cli/types/tools.ts';
import { isPythonLockfileFresh } from '#cli/tools/installers/python/lockfiles.ts';
import { formatExit, runInstallStep, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { listPythonReleases, explainReleaseAgeHold } from '#cli/tools/installers/network/releases.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/tools/installers/credentials.ts';
import { UV_PROGRAM, GSPOT_FOLDER, OWNER_WRITABLE_FILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';

import {
    UV_FLAGS,
    NETWORK_ADVICE,
    PYTHON_TOOL_NOUN,
    UV_SETTINGS_FILE,
    UV_STALE_LOCKFILE,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    UV_PROJECT_ENVIRONMENT,
    UV_PROJECT_INSTALL_ARGUMENTS,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/tools/installers.ts';

async function runUv(
    install: ToolInstall,
    { runFolder, commandArguments, executable, config = join(runFolder, UV_SETTINGS_FILE) }: UvCommand,
): Promise<SpawnResult> {
    const command = [
        executable,
        ...commandArguments,
        UV_FLAGS.project,
        runFolder,
        UV_FLAGS.directory,
        runFolder,
        UV_FLAGS.config,
        config,
    ];
    const result = await runInstallStep(install, command, {
        cwd: runFolder,
        env: { [UV_PROJECT_ENVIRONMENT]: join(runFolder, PYTHON_ENVIRONMENT_FOLDER), UV_PYTHON: undefined },
        step: `running uv ${commandArguments.join(' ')} for ${GSPOT_PATHS.pythonProject}`,
    });
    if (result.end === 'missing') {
        const uv = getTool(readConfigurations().values(), UV_PROGRAM);
        throw new GspotError('install', formatUnavailableNote(uv, { name: UV_PROGRAM, state: 'missing' }));
    }
    if (result.code !== 0) {
        const output = redactInstallOutput(result, install.pythonSettings.credentials);
        const pins = listPackagePins(install.session.toolConfigurations).python;
        const explanation = await explainReleaseAgeHold(install, output, listPythonReleases(pins));
        throw new GspotError(
            'install',
            `${explanation}uv ${String(commandArguments[0])} failed (${formatExit(result)}).\n${output}`,
        );
    }
    return result;
}

/**
Name the Python for a project environment that does not exist yet: the one that a mise config file of the repository
sets for the project folder. uv picks the interpreter when mise is absent, or when no such file sets one. An
environment that exists keeps its Python, because uv builds an environment again for another one and drops what the
project added to it.
*/
async function listInterpreterArguments(install: ToolInstall, cwd: string): Promise<string[]> {
    const { misePath, session } = install;
    const hasEnvironment = statSync(join(cwd, PYTHON_ENVIRONMENT_FOLDER), { throwIfNoEntry: false }) !== undefined;
    if (misePath === undefined || hasEnvironment) return [];
    const python = await findRepositoryPython(session.root, cwd, {
        misePath,
        cancelSignal: session.cancelSignal,
        timeoutSeconds: session.settings.tool_timeout_seconds,
    });
    return python === undefined ? [] : [UV_FLAGS.python, python];
}

export async function planPythonLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    executable: string,
): Promise<ReplacementRequest> {
    const project = buildPythonProjectTable(install.session.toolConfigurations);
    const previous = install.writer.read(GSPOT_PATHS.uvLockfile);
    const saved = previous?.bytes.toString('utf8');
    const { settings: indexes, credentials } = install.pythonSettings;
    if (saved !== undefined && isPythonLockfileFresh(project, saved, indexes, install.releaseAgeDays)) {
        assertCredentialFreeLockfile(saved, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
        return {
            path: GSPOT_PATHS.uvLockfile,
            next: { bytes: Buffer.from(saved), mode: OWNER_WRITABLE_FILE },
            previous,
        };
    }
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PYPROJECT_TOML), toolProjectFile.content);
    writeUvSettings(runFolder, indexes, install.releaseAgeDays);
    await runUv(install, { runFolder, commandArguments: UV_LOCKFILE_ARGUMENTS, executable });
    const lockfile = readFileSync(join(runFolder, UV_LOCKFILE), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, UV_LOCKFILE_CREDENTIAL_MESSAGE);
    return {
        path: GSPOT_PATHS.uvLockfile,
        next: { bytes: Buffer.from(lockfile), mode: OWNER_WRITABLE_FILE },
        previous,
    };
}

export async function installPythonTools(
    install: ToolInstall,
    executable: string,
    flags: readonly string[] = [],
): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const runFolder = join(root, GSPOT_FOLDER);

    using settings = createTemporaryFolder();
    writeUvSettings(settings.path, install.pythonSettings.settings, install.releaseAgeDays);
    await runUv(install, {
        runFolder,
        commandArguments: [...UV_INSTALL_ARGUMENTS, ...flags],
        executable,
        config: join(settings.path, UV_SETTINGS_FILE),
    });
    const count = listPackagePins(toolConfigurations).python.length;
    return `installed ${formatCount(count, PYTHON_TOOL_NOUN)} in ${GSPOT_PATHS.pythonEnvironment}`;
}

export function listLockedPythonProjects(session: Pick<ToolInstall['session'], 'repository' | 'scopes'>): string[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    return session.scopes
        .map((scope) => scope.path)
        .filter(
            (folder) => tracked.has(joinScope(folder, UV_LOCKFILE)) && tracked.has(joinScope(folder, PYPROJECT_TOML)),
        );
}

export async function installPythonProjects(install: ToolInstall, executable: string): Promise<string[]> {
    const { root } = install.session;
    const lines = listLockedPythonProjects(install.session).map((folder) => {
        const place = folder === '' ? ROOT_FOLDER_NAME : folder;
        return { folder, place };
    });
    for (const { folder, place } of lines) {
        const cwd = join(root, folder);
        const python = await listInterpreterArguments(install, cwd);
        await runRequiredInstallStep(install, [executable, ...UV_PROJECT_INSTALL_ARGUMENTS, ...python], {
            cwd,
            step: `installing the Python environment of ${place}`,
            name: `uv sync in ${place}`,
            readAdvice: (result) =>
                UV_STALE_LOCKFILE.test(result.stderr)
                    ? `Run uv lock in ${place} to update ${UV_LOCKFILE}, then run gspot install again.`
                    : NETWORK_ADVICE,
        });
    }
    return lines.map(({ place }) => `installed the Python environment of ${place}`);
}
