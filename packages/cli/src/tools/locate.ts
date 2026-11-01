import which from 'which';
import { remember } from '#cli/system/cache.ts';
import { statSync, realpathSync } from 'node:fs';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { LINE_BREAK, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { listMisePins, buildMiseInstall } from '#cli/tools/pins.ts';
import { type Files, type SpawnResult } from '#cli/types/system.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { GSPOT_PATHS, MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { findProgram, filterOutsidePaths } from '#cli/system/programs.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { executableLayout, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';
import type { MiseTrust, MiseBinPaths, ExecutableList, ExecutableSearch, ToolLookupSession } from '#cli/types/tools.ts';

import {
    MISE_WHICH,
    NPM_BIN_FOLDER,
    TOOL_ENVIRONMENT,
    MISE_CONFIG_NAME,
    MISE_PROJECT_FILES,
    MISE_LAUNCHER_FOLDER,
} from '#cli/config/tools/programs.ts';
import {
    MISE_TOOL,
    MISE_PROJECT_MESSAGE,
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_STALE_PROJECT_MESSAGE,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_TRUSTED_PATHS_VARIABLE,
} from '#cli/config/tools/installers.ts';

const MISE_FOLDERS = Symbol('mise folders');

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

function formatMiseFailure(command: readonly string[], result: SpawnResult): string {
    const detail = result.stderr.trim();
    const failure = `mise ${String(command[1])} failed (exit ${String(result.code)})`;
    return detail === '' ? `${failure}.` : `${failure}: ${detail}`;
}

async function listSystemExecutablePaths(cwd: string, name: string, timeoutSeconds: number): Promise<ExecutableList> {
    const paths = filterOutsidePaths(which.sync(name, { nothrow: true, all: true }) ?? [], GSPOT_FOLDER);
    const mise = findProgram(MISE_TOOL);
    const selected = await Promise.all(
        paths.map(async (path): Promise<ExecutableList> => {
            if (mise === undefined || basename(dirname(path)) !== MISE_LAUNCHER_FOLDER) return { paths: [path] };
            const command = [mise, MISE_WHICH, name];
            const result = await spawnProcess(command, { cwd: cwd, env: TOOL_ENVIRONMENT, timeoutSeconds });
            const program = result.stdout.trim();
            if (result.code !== 0) return { paths: [], failure: formatMiseFailure(['mise', MISE_WHICH], result) };
            return { paths: program === '' ? [] : [program] };
        }),
    );
    return {
        paths: selected.flatMap((list) => list.paths),
        failure: selected.find((list) => list.failure !== undefined)?.failure,
    };
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
@returns the variables, or the reason why mise must not read .gspot.
*/
export function buildMiseTrust(root: string, project: string): MiseTrust {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.miseProject)?.bytes.toString('utf8') !== project)
        return { refusal: MISE_STALE_PROJECT_MESSAGE };
    const names = files.list(GSPOT_FOLDER);
    if (names.some((name) => MISE_CONFIG_NAME.test(name) && !MISE_PROJECT_FILES.has(name)))
        return { refusal: MISE_PROJECT_MESSAGE };
    const folder = realpathSync(join(root, GSPOT_FOLDER));
    return {
        variables: {
            [MISE_TRUSTED_PATHS_VARIABLE]: join(folder, MISE_CONFIG_FILE),
            [MISE_CEILING_PATHS_VARIABLE]: dirname(folder),
        },
    };
}

/**
Ask mise for the program folders of the tools that the mise tool project pins, when mise may read the project.

@param root the folder with the managed mise settings.
@param toolNames the mise tools to find.
@param options the limit for the mise query, and the mise tool project that gspot generates.
@param options.timeoutSeconds the limit for the mise query.
@param options.project the mise tool project that gspot generates.
@returns the folders, or the reason why mise gave none.
*/
export async function readMiseBinPaths(
    root: string,
    toolNames: string[],
    options: { timeoutSeconds: number; project: string },
): Promise<MiseBinPaths> {
    if (toolNames.length === 0 || findProgram(MISE_TOOL) === undefined) return { folders: [] };
    const trust = buildMiseTrust(root, options.project);
    if ('refusal' in trust) return { folders: [], failure: trust.refusal };
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = await spawnProcess(command, {
        cwd: join(root, GSPOT_FOLDER),
        timeoutSeconds: options.timeoutSeconds,
        env: { ...TOOL_ENVIRONMENT, ...trust.variables },
    });
    if (result.code !== 0) return { folders: [], failure: formatMiseFailure(command, result) };
    return { folders: result.stdout.trim().split(LINE_BREAK).filter(Boolean) };
}

/**
List every executable with the name, in the order that gspot prefers. A mise shim on the search path gives the
program that mise selects for the repository, or nothing when mise selects none.

@param root the base for repository searches and the fallback mise query.
@param name the executable to find.
@param options the search folders and tool project installation ownership.

@returns the paths that exist.
*/
export async function listExecutablePaths(
    root: string,
    name: string,
    options: ExecutableSearch & { timeoutSeconds: number },
): Promise<ExecutableList> {
    const found = listRepositoryExecutablePaths(root, name, options);
    if (isAbsolute(name) || options.toolFolderKind !== undefined) return { paths: found };
    const programs = (options.miseBinPaths ?? [])
        .flatMap((folder) => listExecutableNames(name).map((file) => join(folder, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const system = await listSystemExecutablePaths(root, name, options.timeoutSeconds);
    return { paths: [...programs, ...found, ...system.paths], failure: system.failure };
}

/**
Ask mise once for the program folders of the mise tools that the selected configurations pin.

@param session the run whose mise tools to find.
*/
export function readToolBinPaths(session: ToolLookupSession): Promise<MiseBinPaths> {
    return remember(session.toolCache, MISE_FOLDERS, session.toolsRoot, async () => {
        const pins = listMisePins(listSelectedConfigurations(session.scopes));
        return readMiseBinPaths(session.toolsRoot, [...new Set(pins.map((pin) => pin.name))], {
            timeoutSeconds: session.settings.tool_timeout_seconds,
            project: buildMiseInstall(session.toolConfigurations).content,
        });
    });
}
