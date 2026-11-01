import which from 'which';
import { statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import type { SpawnOptions } from '#cli/types/system.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { OUTSIDE_PROGRAMS, GIT_METADATA_NAME } from '#cli/config/system.ts';
import { foldVariableName, buildSpawnEnvironment } from '#cli/system/environment.ts';

const programPaths = new Map<string, string>();

function findRepositoryRoot(): string | undefined {
    for (let folder = process.cwd(); ; folder = dirname(folder)) {
        if (statSync(join(folder, GIT_METADATA_NAME), { throwIfNoEntry: false }) !== undefined) return folder;
        if (folder === dirname(folder)) return undefined;
    }
}

/**
Keep the paths outside the repository of the current folder. On Windows the program search starts in that folder, and a
committed program there can run in place of the installed one.

@param paths the paths that the program search found.
@param keptFolder a repository folder whose paths stay.
*/
export function filterOutsidePaths(paths: readonly string[], keptFolder?: string): string[] {
    const root = findRepositoryRoot();
    return paths.filter((path) => {
        const local = convertToPosixPath(relative(root ?? path, path));
        return (
            root === undefined || !isInside(local) || (keptFolder !== undefined && local.startsWith(`${keptFolder}/`))
        );
    });
}

/**
Find a program on the search path, outside the repository.

@param name the program, without a folder.
@param searchPath the folders to search, which default to `PATH`.
@returns the absolute path, or undefined when no copy sits outside the repository.
*/
export function findProgram(name: string, searchPath?: string): string | undefined {
    const paths = which.sync(name, { all: true, nothrow: true, path: searchPath }) ?? [];
    const [path] = filterOutsidePaths(paths);
    return path;
}

/**
Replace git, mise, node, or npm in a command with the path of the program outside the repository. The search runs once
per folder and search path.

@param command the program and its arguments.
@param env the variable overrides of the process.
@returns the command to run, or undefined when no copy sits outside the repository.
*/
export function selectProgram(command: readonly string[], env: SpawnOptions['env']): readonly string[] | undefined {
    const [name, ...commandArguments] = command as readonly [string, ...string[]];
    if (!OUTSIDE_PROGRAMS.has(name)) return command;
    const variables = Object.entries(buildSpawnEnvironment(env));
    const searchPath = variables.find(([key]) => foldVariableName(key) === 'PATH')?.[1];
    const key = JSON.stringify([name, process.cwd(), searchPath]);
    const path = programPaths.get(key) ?? findProgram(name, searchPath);
    if (path === undefined) return undefined;
    programPaths.set(key, path);
    return [path, ...commandArguments];
}
