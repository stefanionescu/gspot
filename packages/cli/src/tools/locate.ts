// Locate repository executables and mise programs.
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
import { DOT_GSPOT, GSPOT_PYTHON_ENVIRONMENT_PATH } from '#cli/config/system/locations.ts';
import { buildVenvBinPath, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';
import { MISE_WHICH, MISE_PROGRAM, NPM_BIN_FOLDER, MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/find.ts';

// Search folders for tool-project and system executables. A scratch copy has no tool projects or virtual
// environments of its own: they run from the working tree that the copy stands for.
function listSearchFolders(root: string, options: LocateOptions): string[] {
    const { searchFolders, toolProjectKind, installedRoot = root } = options;
    if (toolProjectKind === 'npm') return [join(installedRoot, DOT_GSPOT, NPM_BIN_FOLDER)];
    if (toolProjectKind === 'python') return [buildVenvBinPath(join(installedRoot, GSPOT_PYTHON_ENVIRONMENT_PATH))];
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(basename(folder) === DOT_GSPOT ? join(installedRoot, relative(root, folder)) : folder, NPM_BIN_FOLDER),
        buildVenvBinPath(join(installedRoot, relative(root, folder), PYTHON_ENVIRONMENT_FOLDER)),
    ]);
}

// Check whether a candidate exists. A managed path must resolve inside the root; read other candidates from disk.
function isCandidatePresent(files: Files, root: string, path: string): boolean {
    const local = convertToPosixPath(relative(root, path));
    if (!isInGspotFolder(local)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.readRealPath(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

/**
 * Locate executables on `PATH`, and replace each mise shim with the program that it runs.
 * @param workingFolder the repository root.
 * @param name the executable to find.
 * @param timeoutSeconds the limit for the mise query.
 * @returns the executable paths in preference order.
 */
function listMiseCandidates(workingFolder: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_PROGRAM, { nothrow: true });
    return paths.flatMap((path) => {
        if (basename(dirname(path)) !== 'shims' || mise === null) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: workingFolder,
            env: TOOL_ENV,
            timeoutSeconds: timeoutSeconds,
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
function locateRepositoryCandidates(repositoryRoot: string, name: string, options: LocateOptions): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    using files = openFiles(repositoryRoot);
    const paths = listSearchFolders(repositoryRoot, options).flatMap((folder) =>
        listExecutableNames(name).map((file) => join(folder, file)),
    );
    return paths.filter((path) => isCandidatePresent(files, repositoryRoot, path));
}

/**
 * Read the program folders once per run.
 *
 * @param repositoryRoot the folder with the managed mise settings.
 * @param toolNames the mise tools to find.
 * @param timeoutSeconds the limit for the mise query.
 * @param steps collects each command that install runs.
 *
 * @returns the executable folders that mise installed.
 */
function readMiseBinPaths(
    repositoryRoot: string,
    toolNames: string[],
    timeoutSeconds: number,
    steps: (readonly string[])[],
): string[] {
    if (
        toolNames.length === 0 ||
        which.sync(MISE_PROGRAM, { nothrow: true }) === null ||
        statSync(join(repositoryRoot, DOT_GSPOT), { throwIfNoEntry: false }) === undefined
    )
        return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    steps.push(command);
    const result = spawnProcessBlocking(command, {
        cwd: join(repositoryRoot, DOT_GSPOT),
        timeoutSeconds: timeoutSeconds,
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
function locateCandidates(
    repositoryRoot: string,
    name: string,
    options: LocateOptions & { timeoutSeconds: number; search: 'mise' | 'path' },
): string[] {
    const found = locateRepositoryCandidates(repositoryRoot, name, options);
    if (isAbsolute(name) || options.toolProjectKind !== undefined) return found;
    const programs = (options.miseBinPaths ?? [])
        .flatMap((folder) => listExecutableNames(name).map((file) => join(folder, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const paths =
        options.search === 'mise'
            ? listMiseCandidates(options.installedRoot ?? repositoryRoot, name, options.timeoutSeconds)
            : (which.sync(name, { nothrow: true, all: true }) ?? []);
    return [...programs, ...found, ...paths];
}

export { readMiseBinPaths, locateCandidates, locateRepositoryCandidates };
