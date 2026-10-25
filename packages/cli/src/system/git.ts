import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { spawnProcess, streamProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import type { GitLookup, GitRepository, GitEnvironment, GitVariableGroups } from '#cli/types/system/git.ts';
import { foldVariableName, buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

import {
    type SpawnResult,
    type SpawnOptions,
    type StdoutReader,
    type AsyncSpawnOptions,
} from '#cli/types/system/processes.ts';
import {
    GIT_LOCALE,
    GIT_PROGRAM,
    GIT_DIR_VARIABLE,
    TRAILING_NEWLINE,
    GIT_CLONE_COMMAND,
    GIT_PATH_VARIABLES,
    GIT_HOOKS_ARGUMENTS,
    GIT_VARIABLE_PREFIX,
    NOT_REPOSITORY_CODE,
    GIT_FOLDER_ARGUMENTS,
    GIT_SOURCE_ARGUMENTS,
    GIT_SETTING_ARGUMENTS,
    GIT_WORK_TREE_VARIABLE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_WORK_TREE_ARGUMENTS,
    GIT_COMMAND_CONFIGURATION,
    GIT_LOCAL_VARIABLES_ARGUMENTS,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
} from '#cli/config/system/git.ts';

let inheritedGit: { localVariables: string[]; repository?: GitLookup } | undefined;

function readInheritedGitEnvironment(origin: string): GitLookup {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = readEnvironmentVariable(name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = spawnProcessBlocking([GIT_PROGRAM, ...GIT_SOURCE_ARGUMENTS], {
        cwd: origin,
        env,
    });
    if (source.code !== 0) return { failure: source };
    const line = source.stdout.indexOf('\n');
    const isBare = source.stdout.slice(0, line) === 'true';
    const folder = source.stdout.slice(line + 1).replace(TRAILING_NEWLINE, '');
    if (
        !isBare &&
        readEnvironmentVariable(GIT_DIR_VARIABLE) !== undefined &&
        readEnvironmentVariable(GIT_WORK_TREE_VARIABLE) === undefined
    ) {
        const worktree = spawnProcessBlocking([GIT_PROGRAM, ...GIT_TOP_LEVEL_ARGUMENTS], {
            cwd: origin,
            env,
        });
        if (worktree.code !== 0) return { failure: worktree };
        env[GIT_WORK_TREE_VARIABLE] = worktree.stdout.replace(TRAILING_NEWLINE, '');
    }
    return { folder, env };
}

function readFolderGitEnvironment(root: string, source: GitRepository, environment: GitVariableGroups): GitEnvironment {
    const { isolated, overrides, explicit } = environment;
    const target = spawnProcessBlocking([GIT_PROGRAM, ...GIT_FOLDER_ARGUMENTS], {
        cwd: root,
        env: { ...isolated, ...overrides, ...GIT_LOCALE },
    });
    if (isNotRepository(target)) return { env: { ...isolated, ...explicit } };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = realpathSync(source.folder) === realpathSync(target.stdout.replace(TRAILING_NEWLINE, ''));
    return { env: { ...(isSameRepository ? source.env : isolated), ...explicit } };
}

/**
Build the environment for one Git command. Git lists the repository-local variables and the worktree settings; the
caller overrides apply last.

@param workingFolder the repository folder.
@param command the executable and its arguments, literally.
@param explicit the environment overrides for this command.
@returns the environment for the requested Git command.
*/
export function readGitEnvironment(
    workingFolder: string,
    command: readonly string[],
    explicit: Record<string, string | undefined>,
): GitEnvironment {
    if (
        !Object.keys(buildSpawnEnvironment()).some((key) => {
            const name = foldVariableName(key);
            return name.startsWith(GIT_VARIABLE_PREFIX) && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name);
        })
    )
        return { env: explicit };
    const origin = process.cwd();
    if (inheritedGit === undefined) {
        const listed = spawnProcessBlocking([GIT_PROGRAM, ...GIT_LOCAL_VARIABLES_ARGUMENTS], {
            cwd: origin,
            env: {},
        });
        if (listed.code !== 0) return { failure: listed };
        const localVariables = listed.stdout
            .replace(TRAILING_NEWLINE, '')
            .split('\n')
            .filter((name) => !GIT_COMMAND_CONFIGURATION.has(name));
        inheritedGit = { localVariables };
    }
    const { localVariables } = inheritedGit;
    if (localVariables.every((name) => readEnvironmentVariable(name) === undefined)) return { env: explicit };
    const isolated = Object.fromEntries(localVariables.map((name) => [name, undefined]));
    if ([GIT_PROGRAM, GIT_CLONE_COMMAND].every((word, index) => command[index] === word))
        return { env: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(
        Object.entries(explicit).filter(([name]) => !localVariables.includes(foldVariableName(name))),
    );
    const repository = (inheritedGit.repository ??= readInheritedGitEnvironment(origin));
    return 'failure' in repository
        ? repository
        : readFolderGitEnvironment(workingFolder, repository, { isolated, overrides, explicit });
}

/**
Run Git without a time limit and wait for its result.

@param workingFolder where Git runs.
@param commandArguments the arguments after git.
@param options the other spawn settings, such as the environment.
@returns what Git printed and how it exited.
*/
export function runGitBlocking(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<SpawnOptions, 'cwd' | 'timeoutSeconds'> = {},
): SpawnResult {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = readGitEnvironment(workingFolder, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    return spawnProcessBlocking(command, { ...options, env: selected.env, cwd: workingFolder });
}

/**
Run one Git command and wait for it; the cancel signal in the options stops it.

@param workingFolder where Git runs.
@param commandArguments the arguments after git.
@param options spawn settings for standard input and optional cancellation.
@returns what Git printed and how it exited.
*/
export async function runGit(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<SpawnResult> {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = readGitEnvironment(workingFolder, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    return spawnProcess(command, { ...options, env: selected.env, cwd: workingFolder });
}

/**
Stream Git output with repository isolation and optional cancellation.

@param workingFolder where Git runs.
@param commandArguments the arguments after git.
@param options spawn settings for standard input and optional cancellation.
@param read consumes stdout while Git runs.
@returns the captured stderr and exit status.
*/
export async function runGitStream(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
    read: StdoutReader,
): Promise<SpawnResult> {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = readGitEnvironment(workingFolder, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    return streamProcess(command, { ...options, env: selected.env, cwd: workingFolder }, read);
}

/**
Run Git with cancellation, and keep the output bytes for paths and objects.

@param workingFolder where Git runs.
@param commandArguments the arguments after git.
@param options spawn settings for standard input and optional cancellation.
@returns the bytes Git printed and how it exited.
*/
export async function runGitForBytes(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array }> {
    const chunks: Buffer[] = [];
    const result = await runGitStream(workingFolder, commandArguments, options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}

/**
Read a Git setting, and tell an unset key from a failed command.

@param workingFolder where Git runs.
@param key the Git setting name.
@returns the exact value, or undefined for an unset key.
*/
export function readGitSetting(workingFolder: string, key: string): string | undefined {
    const result = runGitBlocking(workingFolder, [...GIT_SETTING_ARGUMENTS, key]);
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw buildGitError(workingFolder, GIT_SETTING_ARGUMENTS, result);
}

/**
Find the folder that Git runs hooks from: core.hooksPath when set, else the hooks folder of the Git folder.

@param workingFolder the repository root.
@returns the absolute path.
*/
export function readHooksFolder(workingFolder: string): string {
    const result = runGitBlocking(workingFolder, GIT_HOOKS_ARGUMENTS);
    if (result.code !== 0) throw buildGitError(workingFolder, GIT_HOOKS_ARGUMENTS, result);
    return resolve(workingFolder, result.stdout.replace(TRAILING_NEWLINE, ''));
}

/**
Read what a Git command prints, and throw a GspotError when it fails.

@param workingFolder the repository root.
@param commandArguments the arguments after git.
@param options cancellation and input.
@returns the standard output as printed.
*/
export async function readGitText(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string> {
    const result = await runGit(workingFolder, commandArguments, options);
    if (result.code !== 0) throw buildGitError(workingFolder, commandArguments, result);
    return result.stdout;
}

/**
Read the non-empty output lines of a Git command.

@param workingFolder the repository root.
@param commandArguments the arguments after git.
@param options cancellation and input.
@returns the lines, in order.
*/
export async function readGitLines(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string[]> {
    const text = await readGitText(workingFolder, commandArguments, options);
    return text.split('\n').filter((line) => line !== '');
}

/**
Read the paths that a null-separated Git listing names.

@param workingFolder the repository root.
@param commandArguments the arguments after git, which must include -z.
@param options cancellation and input.
@returns the paths, in order.
*/
export async function readGitPaths(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string[]> {
    const text = await readGitText(workingFolder, commandArguments, options);
    return text.split('\0').filter((path) => path !== '');
}

/**
Check whether a Git work tree contains the folder.

@param workingFolder the folder to test.
@returns whether Git confirms a work tree.
@throws when Git cannot tell whether the folder holds a repository.
*/
export function isGitRepository(workingFolder: string): boolean {
    const inspection = runGitBlocking(workingFolder, GIT_WORK_TREE_ARGUMENTS, { env: GIT_LOCALE });
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (isNotRepository(inspection)) return false;
    throw new GspotError(
        'git',
        `Git could not tell whether ${workingFolder} is a work tree (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}

/**
Build the error for a Git command that exited with a failure.

@param workingFolder where Git ran.
@param commandArguments the arguments after git.
@param result how Git exited.
@returns the error to throw.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function buildGitError(
    workingFolder: string,
    commandArguments: readonly string[],
    result: Pick<SpawnResult, 'code' | 'stderr'>,
): GspotError {
    return new GspotError(
        'git',
        `Git ${commandArguments[0] ?? ''} failed in ${workingFolder} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}

/**
Check whether Git refused to run because the folder holds no repository.

@param result how Git exited.
@returns whether Git reported that the folder holds no repository.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in 2 files share it.
export function isNotRepository(result: Pick<SpawnResult, 'code' | 'stderr'>): boolean {
    return result.code === NOT_REPOSITORY_CODE && result.stderr.startsWith(NOT_REPOSITORY_MESSAGE);
}
