import which from 'which';
import { LINE_BREAK } from '#cli/config/text.ts';
import { statSync, realpathSync } from 'node:fs';
import { hasErrorCode } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listMisePins } from '#cli/manifests/tools.ts';
import type { Files } from '#cli/types/system/files.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import { TOOL_ENVIRONMENT } from '#cli/config/executables/run.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import type { ExecutableSearch } from '#cli/types/executables/inspection.ts';
import { MISE_CONFIG_FILE, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { executableLayout, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';

import {
    MISE_TOOL,
    MISE_WHICH,
    NPM_BIN_FOLDER,
    MISE_CONFIG_NAME,
    MISE_PROJECT_FILES,
    MISE_LAUNCHER_FOLDER,
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_TRUSTED_PATHS_VARIABLE,
} from '#cli/config/executables/locate.ts';

function listSearchFolders(root: string, options: ExecutableSearch): string[] {
    const { folders: searchFolders, toolFolderKind } = options;
    if (toolFolderKind === 'npm') return [join(root, GSPOT_FOLDER, NPM_BIN_FOLDER)];
    if (toolFolderKind === 'python')
        return [join(join(root, GSPOT_PATHS.pythonEnvironment), executableLayout.environmentFolder)];
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(folder, NPM_BIN_FOLDER),
        join(folder, PYTHON_ENVIRONMENT_FOLDER, executableLayout.environmentFolder),
    ]);
}

function isExecutablePresent(files: Files, root: string, path: string): boolean {
    if (!convertToPosixPath(relative(root, path)).startsWith(`${GSPOT_FOLDER}/`))
        return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.readCanonicalPath(convertToPosixPath(relative(root, path)));
        return true;
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        return false;
    }
}

function listSystemExecutablePaths(cwd: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_TOOL, { nothrow: true });
    return paths.flatMap((path) => {
        if (mise === null || basename(dirname(path)) !== MISE_LAUNCHER_FOLDER) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: cwd,
            env: TOOL_ENVIRONMENT,
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
    const files = openFiles(root);
    const paths = listSearchFolders(root, options).flatMap((folder) =>
        listExecutableNames(name).map((file) => join(folder, file)),
    );
    return paths.filter((path) => isExecutablePresent(files, root, path));
}

/**
Build the variables that let one mise call read the mise tool project. mise may read it only when it holds the bytes
that gspot generates and no other mise config file sits in .gspot. mise then reads no config of the repository above.

@param root the repository with the mise tool project.
@param project the mise tool project that gspot generates.
@returns the variables, or undefined when mise must not read .gspot.
*/
export function buildMiseTrust(root: string, project: string): Record<string, string> | undefined {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.miseProject)?.bytes.toString('utf8') !== project) return undefined;
    const names = files.list(GSPOT_FOLDER);
    if (names.some((name) => MISE_CONFIG_NAME.test(name) && !MISE_PROJECT_FILES.has(name))) return undefined;
    const folder = realpathSync(join(root, GSPOT_FOLDER));
    return {
        [MISE_TRUSTED_PATHS_VARIABLE]: join(folder, MISE_CONFIG_FILE),
        [MISE_CEILING_PATHS_VARIABLE]: dirname(folder),
    };
}

/**
Ask mise for the program folders of the tools that the mise tool project pins, when mise may read the project.

@param root the folder with the managed mise settings.
@param toolNames the mise tools to find.
@param options the limit for the mise query, and the mise tool project that gspot generates.
@param options.timeoutSeconds the limit for the mise query.
@param options.project the mise tool project that gspot generates.
*/
export function readMiseBinPaths(
    root: string,
    toolNames: string[],
    options: { timeoutSeconds: number; project: string },
): string[] {
    if (toolNames.length === 0 || which.sync(MISE_TOOL, { nothrow: true }) === null) return [];
    const trust = buildMiseTrust(root, options.project);
    if (trust === undefined) return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = spawnProcessBlocking(command, {
        cwd: join(root, GSPOT_FOLDER),
        timeoutSeconds: options.timeoutSeconds,
        env: { ...TOOL_ENVIRONMENT, ...trust },
    });
    return result.code === 0 ? result.stdout.trim().split(LINE_BREAK).filter(Boolean) : [];
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
    return [...programs, ...found, ...listSystemExecutablePaths(root, name, options.timeoutSeconds)];
}

/**
Ask mise for the program folders of the mise tools that the selected configurations pin.

@param session the run whose mise tools to find.
@param project the mise tool project that gspot generates for the run.
*/
export function readToolBinPaths(
    session: Pick<Session, 'scopes' | 'toolsRoot' | 'timeoutSeconds'>,
    project: string,
): string[] {
    const pins = listMisePins(listSelectedConfigurations(session.scopes));
    return readMiseBinPaths(session.toolsRoot, [...new Set(pins.map((pin) => pin.name))], {
        timeoutSeconds: session.timeoutSeconds,
        project,
    });
}
