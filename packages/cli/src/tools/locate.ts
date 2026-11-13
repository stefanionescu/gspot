import { realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';

import which from 'which';

import { GSPOT_PATHS, MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER, LINE_BREAK, PYTHON_ENVIRONMENT_FOLDER, PYTHON_EXECUTABLE } from '#cli/config/system.ts';
import {
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_PROJECT_MESSAGE,
    MISE_STALE_PROJECT_MESSAGE,
    MISE_TOOL,
    MISE_TOOL_SOURCE_ARGUMENTS,
    MISE_TRUSTED_PATHS_VARIABLE,
} from '#cli/config/tools/installers.ts';
import {
    MISE_CONFIG_NAMES,
    MISE_CONFIG_PREFIXES,
    MISE_LAUNCHER_FOLDER,
    MISE_PROJECT_FILES,
    MISE_WHICH,
    NPM_BIN_FOLDER,
    TOOL_ENVIRONMENT,
} from '#cli/config/tools/programs.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { miseToolSourcesSchema } from '#cli/schemas/tools.ts';
import { remember } from '#cli/system/cache.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath, isInside } from '#cli/system/paths.ts';
import {
    executableLayout,
    filterOutsidePaths,
    findProgram,
    listExecutableNames,
} from '#cli/system/processes/programs.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { buildMiseInstall, listMisePins } from '#cli/tools/pins.ts';
import type { Files, SpawnResult } from '#cli/types/system.ts';
import type { ExecutableList, ExecutableSearch, MiseBinPaths, MiseTrust, ToolLookupSession } from '#cli/types/tools.ts';

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
    if (!isGspotPath(convertToPosixPath(relative(root, path))))
        return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.readCanonicalPath(convertToPosixPath(relative(root, path)));
        return true;
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        return false;
    }
}

function formatMiseFailure(subcommand: string, result: SpawnResult): string {
    const detail = result.stderr.trim();
    const failure = `mise ${subcommand} failed (exit ${String(result.code)})`;
    return detail === '' ? `${failure}.` : `${failure}: ${detail}`;
}

async function listSystemExecutablePaths(cwd: string, name: string, timeoutSeconds: number): Promise<ExecutableList> {
    const paths = filterOutsidePaths(which.sync(name, { nothrow: true, all: true }) ?? [], GSPOT_FOLDER);
    const mise = findProgram(MISE_TOOL);
    const selected = await Promise.all(
        paths.map(async (path): Promise<ExecutableList> => {
            if (mise === undefined || basename(dirname(path)) !== MISE_LAUNCHER_FOLDER) return { paths: [path] };
            const command = [mise, MISE_WHICH, name];
            const result = await runProcess(command, { cwd, env: TOOL_ENVIRONMENT, timeoutSeconds });
            const program = result.stdout.trim();
            if (result.code !== 0) return { paths: [], failure: formatMiseFailure(MISE_WHICH, result) };
            return { paths: program === '' ? [] : [program] };
        }),
    );
    return {
        paths: selected.flatMap((list) => list.paths),
        failure: selected.find((list) => list.failure !== undefined)?.failure,
    };
}

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
*/
export function buildMiseTrust(root: string, project: string): MiseTrust {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.miseProject)?.bytes.toString('utf8') !== project)
        return { refusal: MISE_STALE_PROJECT_MESSAGE };
    const names = files.list(GSPOT_FOLDER);
    const configNames = names.filter(
        (name) => MISE_CONFIG_NAMES.has(name) || MISE_CONFIG_PREFIXES.some((prefix) => name.startsWith(prefix)),
    );
    if (configNames.some((name) => !MISE_PROJECT_FILES.has(name))) return { refusal: MISE_PROJECT_MESSAGE };
    const folder = realpathSync(join(root, GSPOT_FOLDER));
    return {
        variables: {
            [MISE_TRUSTED_PATHS_VARIABLE]: join(folder, MISE_CONFIG_FILE),
            [MISE_CEILING_PATHS_VARIABLE]: dirname(folder),
        },
    };
}

export async function readMiseBinPaths(
    root: string,
    toolNames: string[],
    options: { timeoutSeconds: number; project: string },
): Promise<MiseBinPaths> {
    if (toolNames.length === 0 || findProgram(MISE_TOOL) === undefined) return { folders: [] };
    const trust = buildMiseTrust(root, options.project);
    if ('refusal' in trust) return { folders: [], failure: trust.refusal };
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = await runProcess(command, {
        cwd: join(root, GSPOT_FOLDER),
        timeoutSeconds: options.timeoutSeconds,
        env: { ...TOOL_ENVIRONMENT, ...trust.variables },
    });
    return result.code === 0
        ? { folders: result.stdout.trim().split(LINE_BREAK).filter(Boolean) }
        : { folders: [], failure: formatMiseFailure(MISE_BIN_PATHS_ARGUMENTS[1], result) };
}

/**
List the executables with the name, in the order that gspot prefers. The system search path counts only when neither
mise nor the repository holds the executable. A mise shim on the search path gives the program that mise selects for
the repository, or nothing when mise selects none.
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
    const managed = [...programs, ...found];
    if (managed.length > 0) return { paths: managed };
    return await listSystemExecutablePaths(root, name, options.timeoutSeconds);
}

/**
Find the Python that a mise config file of the repository sets for a folder. A Python that only a config file above the
repository names does not count, because the repository does not ask for it.
*/
export async function findRepositoryPython(
    root: string,
    cwd: string,
    options: { misePath: string; timeoutSeconds: number; cancelSignal?: AbortSignal | undefined },
): Promise<string | undefined> {
    const { misePath, ...limits } = options;
    const spawn = { cwd, env: TOOL_ENVIRONMENT, ...limits };
    const listed = await runProcess([misePath, ...MISE_TOOL_SOURCE_ARGUMENTS, PYTHON_EXECUTABLE], spawn);
    if (listed.code !== 0) return undefined;
    const source = parseToolOutput(MISE_TOOL, listed.stdout, miseToolSourcesSchema)[0]?.source?.path;
    if (source === undefined || !isInside(relative(root, source))) return undefined;
    const found = await runProcess([misePath, MISE_WHICH, PYTHON_EXECUTABLE], spawn);
    const python = found.stdout.trim();
    return found.code === 0 && python !== '' ? python : undefined;
}

export function readToolBinPaths(session: ToolLookupSession): Promise<MiseBinPaths> {
    return remember(session.toolCache, MISE_FOLDERS, session.toolsRoot, async () => {
        const pins = listMisePins(listSelectedConfigurations(session.scopes));
        return readMiseBinPaths(session.toolsRoot, [...new Set(pins.map((pin) => pin.name))], {
            timeoutSeconds: session.settings.tool_timeout_seconds,
            project: buildMiseInstall(session.toolConfigurations).content,
        });
    });
}
