// Locates repository executables and mise programs.
import which from 'which';
import { statSync } from 'node:fs';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import type { LocateOptions } from '#cli/types/tools/find.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { DOT_GSPOT, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/system/locations.ts';
import { buildVenvBinPath, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';

import {
    MISE_WHICH,
    MISE_PROGRAM,
    NPM_BIN_FOLDER,
    MISE_SHIMS_FOLDER,
    MISE_BIN_PATHS_ARGUMENTS,
} from '#cli/config/tools/find.ts';

// Search folders for tool-project and system executables. A copy has no tool projects or virtual
// environments of its own: they run from the working tree the copy stands for.
function listSearchFolders(root: string, options: LocateOptions): string[] {
    const { searchFolders, toolProjectKind, installedRoot = root } = options;
    if (toolProjectKind === 'npm') return [join(installedRoot, DOT_GSPOT, NPM_BIN_FOLDER)];
    if (toolProjectKind === 'python') return [buildVenvBinPath(join(installedRoot, PYTHON_ENVIRONMENT_DIRECTORY))];
    // A copy's tool projects run from the original working tree.
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(basename(folder) === DOT_GSPOT ? join(installedRoot, relative(root, folder)) : folder, NPM_BIN_FOLDER),
        buildVenvBinPath(join(installedRoot, relative(root, folder), PYTHON_ENVIRONMENT_FOLDER)),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the root boundary, read other candidates directly from disk.
function isCandidatePresent(files: Files, root: string, path: string): boolean {
    const local = convertToPosixPath(relative(root, path));
    if (!isInGspotFolder(local)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.realPath(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

/**
 * Locate executables on `PATH` and replace mise shims with their selected program.
 * @param root the repository root.
 * @param name the executable name.
 * @param timeoutSeconds the tool timeout in seconds.
 * @returns the executable paths in preference order.
 */
function listMiseCandidates(root: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_PROGRAM, { nothrow: true });
    return paths.flatMap((path) => {
        if (basename(dirname(path)) !== MISE_SHIMS_FOLDER || mise === null) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: root,
            env: TOOL_ENV,
            timeoutSeconds: timeoutSeconds,
        });
        const selected = result.stdout.trim();
        return result.code === 0 && selected !== '' ? [selected] : [];
    });
}

/**
 * Executables owned by the repository or its selected tool project installation, without executables from the system search path.
 *
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and installation ownership.
 *
 * @returns repository candidates in preference order.
 */
export function locateRepositoryCandidates(root: string, name: string, options: LocateOptions): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    using files = openFiles(root);
    const paths = listSearchFolders(root, options).flatMap((folder) =>
        listExecutableNames(name).map((file) => join(folder, file)),
    );
    return paths.filter((path) => isCandidatePresent(files, root, path));
}

/**
 * Read the selected program folders once for a command session.
 *
 * @param root the repository root.
 * @param toolNames the selected mise tool names.
 * @param timeoutSeconds the tool timeout in seconds.
 * @param steps the commands attempted during installation.
 *
 * @returns the installed executable directories selected by mise.
 */
export function readMiseBinPaths(
    root: string,
    toolNames: string[],
    timeoutSeconds: number,
    steps: (readonly string[])[],
): string[] {
    if (
        toolNames.length === 0 ||
        which.sync('mise', { nothrow: true }) === null ||
        statSync(join(root, DOT_GSPOT), { throwIfNoEntry: false }) === undefined
    )
        return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    steps.push(command);
    const result = spawnProcessBlocking(command, {
        cwd: join(root, DOT_GSPOT),
        timeoutSeconds: timeoutSeconds,
        env: TOOL_ENV,
    });
    return result.code === 0 ? result.stdout.trim().split(/\r?\n/u).filter(Boolean) : [];
}

/**
 * Every executable of the name, in the order gspot prefers them.
 *
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and tool project installation ownership.
 *
 * @returns the paths that exist.
 */
export function locateCandidates(
    root: string,
    name: string,
    options: LocateOptions & { timeoutSeconds: number },
): string[] {
    const found = locateRepositoryCandidates(root, name, options);
    if (isAbsolute(name) || options.toolProjectKind !== undefined) return found;
    const programs = (options.miseBinPaths ?? [])
        .flatMap((folder) => listExecutableNames(name).map((file) => join(folder, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const paths =
        options.miseBinPaths === undefined
            ? listMiseCandidates(options.installedRoot ?? root, name, options.timeoutSeconds)
            : (which.sync(name, { nothrow: true, all: true }) ?? []);
    return [...programs, ...found, ...paths];
}
