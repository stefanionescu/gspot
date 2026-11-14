import which from 'which';
import { statSync } from 'node:fs';
import type { Files } from '#cli/types/system.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { formatMiseFailure } from '#cli/tools/programs/mise.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import type { ExecutableList, ExecutableSearch } from '#cli/types/tools.ts';
import { MISE_WHICH, MISE_LAUNCHER_FOLDER } from '#cli/config/tools/mise.ts';
import { NPM_BIN_FOLDER, TOOL_ENVIRONMENT } from '#cli/config/tools/programs.ts';
import { GSPOT_FOLDER, MISE_PROGRAM, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';

import {
    findProgram,
    executableLayout,
    filterOutsidePaths,
    listExecutableNames,
} from '#cli/system/processes/programs.ts';

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

async function listSystemExecutablePaths(cwd: string, name: string, timeoutSeconds: number): Promise<ExecutableList> {
    const paths = filterOutsidePaths(which.sync(name, { nothrow: true, all: true }) ?? [], GSPOT_FOLDER);
    const mise = findProgram(MISE_PROGRAM);
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
