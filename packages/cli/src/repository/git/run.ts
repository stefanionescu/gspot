import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { runProcess, streamProcess } from '#cli/system/processes.ts';
import type { SpawnResult, StdoutReader, CancelableSpawnOptions } from '#cli/types/system.ts';
import type { GitLookup, GitRepository, GitEnvironment, GitVariableGroups } from '#cli/types/repository.ts';
import { foldVariableName, buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';

import {
    GIT_LOCALE,
    GIT_PROGRAM,
    TRAILING_NEWLINE,
    GIT_PATH_VARIABLES,
    GIT_FOLDER_VARIABLE,
    GIT_HOOKS_ARGUMENTS,
    GIT_VARIABLE_PREFIX,
    NOT_REPOSITORY_CODE,
    GIT_FOLDER_ARGUMENTS,
    GIT_SOURCE_ARGUMENTS,
    GIT_SETTING_ARGUMENTS,
    GIT_CREATION_COMMANDS,
    GIT_WORK_TREE_VARIABLE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_COMMAND_CONFIGURATION,
    GIT_LOCAL_VARIABLES_ARGUMENTS,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
} from '#cli/config/repository/git.ts';

const folderEnvironments = new Map<string, Promise<GitEnvironment>>();

let localVariablesRead: Promise<SpawnResult> | undefined;

let inheritedRepository: Promise<GitLookup> | undefined;

async function readInheritedGitEnvironment(origin: string): Promise<GitLookup> {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = readEnvironmentVariable(name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = await runProcess([GIT_PROGRAM, ...GIT_SOURCE_ARGUMENTS], {
        cwd: origin,
        env,
    });
    if (source.code !== 0) return { failure: source };
    const line = source.stdout.indexOf('\n');
    const isBare = source.stdout.slice(0, line) === 'true';
    const folder = source.stdout.slice(line + 1).replace(TRAILING_NEWLINE, '');
    if (
        !isBare &&
        readEnvironmentVariable(GIT_FOLDER_VARIABLE) !== undefined &&
        readEnvironmentVariable(GIT_WORK_TREE_VARIABLE) === undefined
    ) {
        const worktree = await runProcess([GIT_PROGRAM, ...GIT_TOP_LEVEL_ARGUMENTS], {
            cwd: origin,
            env,
        });
        if (worktree.code !== 0) return { failure: worktree };
        env[GIT_WORK_TREE_VARIABLE] = worktree.stdout.replace(TRAILING_NEWLINE, '');
    }
    return { folder, environment: env };
}

async function readFolderGitEnvironment(
    root: string,
    source: GitRepository,
    { isolated, overrides }: GitVariableGroups,
): Promise<GitEnvironment> {
    const target = await runProcess([GIT_PROGRAM, ...GIT_FOLDER_ARGUMENTS], {
        cwd: root,
        env: { ...isolated, ...overrides, ...GIT_LOCALE },
    });
    if (isOutsideRepository(target)) return { variables: isolated };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = realpathSync(source.folder) === realpathSync(target.stdout.replace(TRAILING_NEWLINE, ''));
    return { variables: isSameRepository ? source.environment : isolated };
}

async function selectFolderEnvironment(
    cwd: string,
    origin: string,
    groups: GitVariableGroups,
): Promise<GitEnvironment> {
    inheritedRepository ??= readInheritedGitEnvironment(origin);
    const repository = await inheritedRepository;
    if ('failure' in repository) return repository;
    const folder = folderEnvironments.get(cwd) ?? readFolderGitEnvironment(cwd, repository, groups);
    folderEnvironments.set(cwd, folder);
    return await folder;
}

/**
Build the environment for one Git command. Git lists the repository-local variables and the worktree settings once a
process, and each folder resolves once; the caller overrides apply last.

@param cwd the repository folder.
@param command the executable and its arguments, literally.
@param explicit the environment overrides for this command.
*/
export async function buildGitEnvironment(
    cwd: string,
    command: readonly string[],
    explicit: Record<string, string | undefined>,
): Promise<GitEnvironment> {
    if (
        !Object.keys(buildSpawnEnvironment()).some((key) => {
            const name = foldVariableName(key);
            return name.startsWith(GIT_VARIABLE_PREFIX) && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name);
        })
    )
        return { variables: explicit };
    const origin = process.cwd();
    localVariablesRead ??= runProcess([GIT_PROGRAM, ...GIT_LOCAL_VARIABLES_ARGUMENTS], { cwd: origin, env: {} });
    const listed = await localVariablesRead;
    if (listed.code !== 0) return { failure: listed };
    const localVariables = listed.stdout
        .replace(TRAILING_NEWLINE, '')
        .split('\n')
        .filter((name) => !GIT_COMMAND_CONFIGURATION.has(name));
    if (localVariables.every((name) => readEnvironmentVariable(name) === undefined)) return { variables: explicit };
    const isolated = Object.fromEntries(localVariables.map((name) => [name, undefined]));
    if (GIT_CREATION_COMMANDS.some((words) => words.every((word, index) => command[index] === word)))
        return { variables: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(
        Object.entries(explicit).filter(([name]) => !localVariables.includes(foldVariableName(name))),
    );
    const environment = await selectFolderEnvironment(cwd, origin, { isolated, overrides });
    return 'failure' in environment ? environment : { variables: { ...environment.variables, ...explicit } };
}

/**
Run one Git command and wait for it; the cancel signal in the options stops it.

@param cwd where Git runs.
@param commandArguments the arguments after git.
@param options the standard input and the cancel signal.
*/
export async function runGit(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<SpawnResult> {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = await buildGitEnvironment(cwd, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    return runProcess(command, { ...options, env: selected.variables, cwd: cwd });
}

/**
Stream Git output with repository isolation and optional cancellation.

@param cwd where Git runs.
@param commandArguments the arguments after git.
@param options the standard input and the cancel signal.
@param readStdout consumes stdout while Git runs.
*/
export async function runGitStream(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
    readStdout: StdoutReader,
): Promise<SpawnResult> {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = await buildGitEnvironment(cwd, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    return streamProcess(command, { ...options, env: selected.variables, cwd: cwd }, readStdout);
}

/**
Run Git with cancellation, and keep the output bytes for paths and objects.

@param cwd where Git runs.
@param commandArguments the arguments after git.
@param options the standard input and the cancel signal.
*/
export async function runGitBytes(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<Omit<SpawnResult, 'stdout'> & { stdout: Uint8Array }> {
    const chunks: Buffer[] = [];
    const result = await runGitStream(cwd, commandArguments, options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}

/**
Read a Git setting, and tell an unset key from a failed command.

@param cwd where Git runs.
@param key the Git setting name.
@returns undefined for an unset key.
*/
export async function readGitSetting(cwd: string, key: string): Promise<string | undefined> {
    const result = await runGit(cwd, [...GIT_SETTING_ARGUMENTS, key], {});
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw buildGitError(cwd, GIT_SETTING_ARGUMENTS, result);
}

/**
Find the folder that Git runs hooks from: core.hooksPath when set, else the hooks folder of the Git folder.

@param cwd the repository root.
@returns the absolute path.
*/
export async function readHooksFolder(cwd: string): Promise<string> {
    const result = await runGit(cwd, GIT_HOOKS_ARGUMENTS, {});
    if (result.code !== 0) throw buildGitError(cwd, GIT_HOOKS_ARGUMENTS, result);
    return resolve(cwd, result.stdout.replace(TRAILING_NEWLINE, ''));
}

/**
Read what a Git command prints, and throw a GspotError when it fails.

@param cwd the repository root.
@param commandArguments the arguments after git.
@param options cancellation and input.
@returns the standard output as printed.
*/
export async function readGitText(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string> {
    const result = await runGit(cwd, commandArguments, options);
    if (result.code !== 0) throw buildGitError(cwd, commandArguments, result);
    return result.stdout;
}

/**
Read the non-empty output lines of a Git command.

@param cwd the repository root.
@param commandArguments the arguments after git.
@param options cancellation and input.
*/
export async function readGitLines(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string[]> {
    const text = await readGitText(cwd, commandArguments, options);
    return text.split('\n').filter((line) => line !== '');
}

/**
Read paths from a null-separated Git listing. Exclude paths with invalid UTF-8.

@param cwd the repository root.
@param commandArguments the arguments after git, which must include -z.
@param options cancellation and input.
*/
export async function readGitPaths(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string[]> {
    const result = await runGitBytes(cwd, commandArguments, options);
    if (result.code !== 0) throw buildGitError(cwd, commandArguments, result);
    return Buffer.from(result.stdout)
        .toString('latin1')
        .split('\0')
        .map((path) => decodeUtf8(Buffer.from(path, 'latin1')))
        .filter((path): path is string => path !== undefined && path !== '');
}

/**
Build the error for a Git command that exited with a failure.

@param cwd where Git ran.
@param commandArguments the arguments after git.
@param result how Git exited.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Git commands in main.ts and repository code report a failure with this one message.
export function buildGitError(
    cwd: string,
    commandArguments: readonly string[],
    result: Pick<SpawnResult, 'code' | 'stderr'>,
): GspotError {
    return new GspotError(
        'git',
        `Git ${commandArguments[0] ?? ''} failed in ${cwd} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}

/**
Check whether Git refused to run because the folder holds no repository.

@param result how Git exited.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The repository read and the Git commands tell a folder without a repository apart by this one test.
export function isOutsideRepository(result: Pick<SpawnResult, 'code' | 'stderr'>): boolean {
    return result.code === NOT_REPOSITORY_CODE && result.stderr.startsWith(NOT_REPOSITORY_MESSAGE);
}
