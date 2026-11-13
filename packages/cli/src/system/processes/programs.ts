import { statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import which from 'which';

import { EXECUTABLE_LAYOUTS, GIT_METADATA_NAME, OUTSIDE_PROGRAMS } from '#cli/config/system.ts';
import { buildSpawnEnvironment, foldVariableName } from '#cli/system/environment.ts';
import { convertToPosixPath, isInside } from '#cli/system/paths.ts';
import type { SpawnOptions } from '#cli/types/system.ts';

const programPaths = new Map<string, string>();

export const executableLayout = process.platform === 'win32' ? EXECUTABLE_LAYOUTS.windows : EXECUTABLE_LAYOUTS.posix;

function findRepositoryRoot(): string | undefined {
    for (let folder = process.cwd(); ; folder = dirname(folder)) {
        if (statSync(join(folder, GIT_METADATA_NAME), { throwIfNoEntry: false }) !== undefined) return folder;
        if (folder === dirname(folder)) return undefined;
    }
}

/**
Keep the paths outside the repository of the current folder. On Windows the program search starts in that folder, and a
committed program there can run in place of the installed one.
*/
export function filterOutsidePaths(paths: readonly string[], keptFolder?: string): string[] {
    const root = findRepositoryRoot();
    if (root === undefined) return [...paths];
    return paths.filter((path) => {
        const local = convertToPosixPath(relative(root, path));
        return !isInside(local) || (keptFolder !== undefined && local.startsWith(`${keptFolder}/`));
    });
}

export function listExecutableNames(name: string): string[] {
    return executableLayout.executableSuffixes.map((suffix) => name + suffix);
}

export function findProgram(name: string, searchPath?: string): string | undefined {
    const paths = which.sync(name, { all: true, nothrow: true, path: searchPath }) ?? [];
    const [path] = filterOutsidePaths(paths);
    return path;
}

export function findProgramCommand(
    command: readonly string[],
    env: SpawnOptions['env'],
): readonly string[] | undefined {
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
