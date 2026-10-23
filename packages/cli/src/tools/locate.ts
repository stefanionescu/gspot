import which from 'which';
import { statSync } from 'node:fs';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import type { ExecutableSearch } from '#cli/types/tools/inspection.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { buildVenvBinPath, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';

import {
    MISE_TOOL,
    MISE_WHICH,
    NPM_BIN_FOLDER,
    MISE_LAUNCHER_FOLDER,
    MISE_BIN_PATHS_ARGUMENTS,
} from '#cli/config/tools/locate.ts';

function listSearchFolders(root: string, options: ExecutableSearch): string[] {
    const { searchFolders, toolFolderKind } = options;
    if (toolFolderKind === 'npm') return [join(root, DOT_GSPOT, NPM_BIN_FOLDER)];
    if (toolFolderKind === 'python') return [buildVenvBinPath(join(root, GSPOT_PATHS.pythonEnvironment))];
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(folder, NPM_BIN_FOLDER),
        buildVenvBinPath(join(folder, PYTHON_ENVIRONMENT_FOLDER)),
    ]);
}

function isExecutablePresent(files: Files, root: string, path: string): boolean {
    const local = convertToPosixPath(relative(root, path));
    if (!local.startsWith(`${DOT_GSPOT}/`)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.readCanonicalPath(local);
        return true;
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        return false;
    }
}

function listMiseExecutablePaths(workingFolder: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_TOOL, { nothrow: true });
    return paths.flatMap((path) => {
        if (basename(dirname(path)) !== MISE_LAUNCHER_FOLDER || mise === null) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: workingFolder,
            env: TOOL_ENV,
            timeoutSeconds,
        });
        const selected = result.stdout.trim();
        return result.code === 0 && selected !== '' ? [selected] : [];
    });
}

/**
 * List the executables of the repository or its tool project, without the system search path.
 *
 * @param repositoryRoot the boundary for validating managed executable paths.
 * @param name the executable to find.
 * @param options the search folders and installation ownership.
 *
 * @returns the executable paths that exist, without the system `PATH`.
 */
export function listRepositoryExecutablePaths(
    repositoryRoot: string,
    name: string,
    options: ExecutableSearch,
): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    using files = openFiles(repositoryRoot);
    const paths = listSearchFolders(repositoryRoot, options).flatMap((folder) =>
        listExecutableNames(name).map((file) => join(folder, file)),
    );
    return paths.filter((path) => isExecutablePresent(files, repositoryRoot, path));
}

/**
 * Ask mise for the program folders of the tools that the mise tool project pins.
 *
 * @param repositoryRoot the folder with the managed mise settings.
 * @param toolNames the mise tools to find.
 * @param timeoutSeconds the limit for the mise query.
 * @returns the executable folders that mise installed.
 */
export function readMiseBinPaths(repositoryRoot: string, toolNames: string[], timeoutSeconds: number): string[] {
    if (
        toolNames.length === 0 ||
        which.sync(MISE_TOOL, { nothrow: true }) === null ||
        statSync(join(repositoryRoot, DOT_GSPOT), { throwIfNoEntry: false }) === undefined
    )
        return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = spawnProcessBlocking(command, {
        cwd: join(repositoryRoot, DOT_GSPOT),
        timeoutSeconds,
        env: TOOL_ENV,
    });
    return result.code === 0 ? result.stdout.trim().split(/\r?\n/u).filter(Boolean) : [];
}

/**
 * List every executable with the name, in the order that gspot prefers.
 *
 * @param repositoryRoot the base for repository searches and the fallback mise query.
 * @param name the executable to find.
 * @param options the search folders and tool project installation ownership.
 *
 * @returns the paths that exist.
 */
export function listExecutablePaths(
    repositoryRoot: string,
    name: string,
    options: ExecutableSearch & { timeoutSeconds: number; search: 'mise' | 'path' },
): string[] {
    const found = listRepositoryExecutablePaths(repositoryRoot, name, options);
    if (isAbsolute(name) || options.toolFolderKind !== undefined) return found;
    const programs = (options.miseBinPaths ?? [])
        .flatMap((folder) => listExecutableNames(name).map((file) => join(folder, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const paths =
        options.search === 'mise'
            ? listMiseExecutablePaths(repositoryRoot, name, options.timeoutSeconds)
            : (which.sync(name, { nothrow: true, all: true }) ?? []);
    return [...programs, ...found, ...paths];
}

/**
 * Read and cache the installed mise folders when a tool search needs them.
 *
 * @param session the run whose tools select the mise query.
 * @returns the folders that mise installed.
 */
export function getMiseBinPaths(session: Session): string[] {
    session.miseBinPaths ??= readMiseBinPaths(
        session.installedRoot,
        [...new Set(listMisePins(listSelectedConfigurations(session.scopes)).map((pin) => pin.name))],
        session.timeoutSeconds,
    );
    return session.miseBinPaths;
}

/**
 * Locate uv when a Python installation needs it, and reuse it for the run.
 *
 * @param session the working tree and its tool search cache.
 * @returns the uv program to run.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function getUvPath(session: Session): string {
    session.uvPath ??=
        listExecutablePaths(session.installedRoot, UV_TOOL, {
            search: 'path',
            searchFolders: [],
            miseBinPaths: getMiseBinPaths(session),
            timeoutSeconds: session.timeoutSeconds,
        })[0] ?? UV_TOOL;
    return session.uvPath;
}
