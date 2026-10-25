import which from 'which';
import { statSync } from 'node:fs';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import type { ExecutableSearch } from '#cli/types/tools/inspection.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
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
    if (toolFolderKind === 'npm') return [join(root, GSPOT_FOLDER, NPM_BIN_FOLDER)];
    if (toolFolderKind === 'python') return [buildVenvBinPath(join(root, GSPOT_PATHS.pythonEnvironment))];
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(folder, NPM_BIN_FOLDER),
        buildVenvBinPath(join(folder, PYTHON_ENVIRONMENT_FOLDER)),
    ]);
}

function isExecutablePresent(files: Files, root: string, path: string): boolean {
    if (!isInGspotFolder(root, path)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.readCanonicalPath(convertToPosixPath(relative(root, path)));
        return true;
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        return false;
    }
}

function listMiseExecutablePaths(cwd: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_TOOL, { nothrow: true });
    return paths.flatMap((path) => {
        if (mise === null || basename(dirname(path)) !== MISE_LAUNCHER_FOLDER) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: cwd,
            env: TOOL_ENV,
            timeoutSeconds,
        });
        const selected = result.stdout.trim();
        return selected !== '' && result.code === 0 ? [selected] : [];
    });
}

/**
List the executables of the repository or its tool project, without the system search path.

@param root the boundary for validating managed executable paths.
@param name the executable to find.
@param options the search folders and installation ownership.

@returns the executable paths that exist, without the system `PATH`.
*/
export function listRepositoryExecutablePaths(root: string, name: string, options: ExecutableSearch): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    using files = openFiles(root);
    const paths = listSearchFolders(root, options).flatMap((folder) =>
        listExecutableNames(name).map((file) => join(folder, file)),
    );
    return paths.filter((path) => isExecutablePresent(files, root, path));
}

/**
Ask mise for the program folders of the tools that the mise tool project pins.

@param root the folder with the managed mise settings.
@param toolNames the mise tools to find.
@param timeoutSeconds the limit for the mise query.
@returns the executable folders that mise installed.
*/
export function readMiseBinPaths(root: string, toolNames: string[], timeoutSeconds: number): string[] {
    if (
        toolNames.length === 0 ||
        which.sync(MISE_TOOL, { nothrow: true }) === null ||
        statSync(join(root, GSPOT_FOLDER), { throwIfNoEntry: false }) === undefined
    )
        return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = spawnProcessBlocking(command, {
        cwd: join(root, GSPOT_FOLDER),
        timeoutSeconds,
        env: TOOL_ENV,
    });
    return result.code === 0 ? result.stdout.trim().split(/\r?\n/u).filter(Boolean) : [];
}

/**
List every executable with the name, in the order that gspot prefers. A mise shim on the search path gives the
program that mise selects for the repository, or nothing when mise selects none.

@param root the base for repository searches and the fallback mise query.
@param name the executable to find.
@param options the search folders and tool project installation ownership.

@returns the paths that exist.
*/
export function listExecutablePaths(
    root: string,
    name: string,
    options: ExecutableSearch & { timeoutSeconds: number },
): string[] {
    const found = listRepositoryExecutablePaths(root, name, options);
    if (isAbsolute(name) || options.toolFolderKind !== undefined) return found;
    const programs = (options.miseBinPaths ?? [])
        .flatMap((folder) => listExecutableNames(name).map((file) => join(folder, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    return [...programs, ...found, ...listMiseExecutablePaths(root, name, options.timeoutSeconds)];
}

/**
Ask mise for the program folders of the mise tools that the selected configurations pin.

@param session the configurations of the run, the working tree with the installed tools, and the time limit.
@returns the executable folders that mise installed.
*/
export function readToolBinPaths(session: Pick<Session, 'scopes' | 'toolsRoot' | 'timeoutSeconds'>): string[] {
    const pins = listMisePins(listSelectedConfigurations(session.scopes));
    return readMiseBinPaths(session.toolsRoot, [...new Set(pins.map((pin) => pin.name))], session.timeoutSeconds);
}

/**
Check whether a path sits inside the gspot folder, where the npm and Python tool projects live.

@param root the repository root.
@param path the absolute path.
@returns whether the path sits inside the gspot folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function isInGspotFolder(root: string, path: string): boolean {
    return convertToPosixPath(relative(root, path)).startsWith(`${GSPOT_FOLDER}/`);
}
