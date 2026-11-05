import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import {
    COPIES_FOLDER,
    GIT_COMMAND_CONFIGURATION,
    GIT_CREATION_COMMANDS,
    GIT_FOLDER_VARIABLE,
    GIT_HOOKS_ARGUMENTS,
    GIT_LOCAL_VARIABLES_ARGUMENTS,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
    GIT_PATH_VARIABLES,
    GIT_PROGRAM,
    GIT_SETTING_ARGUMENTS,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_VARIABLE_PREFIX,
    GIT_WORK_TREE_VARIABLE,
    NOT_REPOSITORY_CODE,
    NOT_REPOSITORY_MESSAGE,
    TRAILING_NEWLINE,
} from '#cli/config/repository/git.ts';
import { buildSpawnEnvironment, foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { isInside } from '#cli/system/paths.ts';
import { runProcess, streamProcess } from '#cli/system/processes.ts';
import type { GitEnvironment, GitLookup } from '#cli/types/repository.ts';
import type { CancelableSpawnOptions, SpawnResult, StdoutReader } from '#cli/types/system.ts';

const localVariableReads = new Map<string, Promise<SpawnResult>>();

const inheritedRepositories = new Map<string, Promise<GitLookup>>();

async function readInheritedGitEnvironment(origin: string): Promise<GitLookup> {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = readEnvironmentVariable(name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const worktree = await runProcess([GIT_PROGRAM, ...GIT_TOP_LEVEL_ARGUMENTS], { cwd: origin, env });
    if (worktree.code !== 0) return { failure: worktree };
    const root = worktree.stdout.replace(TRAILING_NEWLINE, '');
    if (
        readEnvironmentVariable(GIT_FOLDER_VARIABLE) !== undefined &&
        readEnvironmentVariable(GIT_WORK_TREE_VARIABLE) === undefined
    )
        env[GIT_WORK_TREE_VARIABLE] = root;
    return { root: realpathSync(root), environment: env };
}

async function selectWorkTreeVariables(
    cwd: string,
    origin: string,
    isolated: Record<string, undefined>,
): Promise<GitEnvironment> {
    const repositoryRead = inheritedRepositories.get(origin) ?? readInheritedGitEnvironment(origin);
    inheritedRepositories.set(origin, repositoryRead);
    const repository = await repositoryRead;
    if ('failure' in repository) return repository;
    const local = relative(repository.root, realpathSync(cwd));
    const isWorkTree = isInside(local) && !isInside(relative(COPIES_FOLDER, local));
    return { variables: isWorkTree ? repository.environment : isolated };
}

/**
Build the environment for one Git command. Git lists the repository-local variables and the work tree once for each
working folder of the process. A command in that work tree inherits the variables with absolute paths. A command in a
check copy under .gspot-copies, or outside the work tree, runs without them. The caller overrides apply last.

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
    const localVariablesRead =
        localVariableReads.get(origin) ??
        runProcess([GIT_PROGRAM, ...GIT_LOCAL_VARIABLES_ARGUMENTS], { cwd: origin, env: {} });
    localVariableReads.set(origin, localVariablesRead);
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
    const environment = await selectWorkTreeVariables(cwd, origin, isolated);
    return 'failure' in environment ? environment : { variables: { ...environment.variables, ...explicit } };
}

/**
Run one Git command and wait for it; the cancel signal in the options stops it. With a reader, Git streams its output
to the reader, and the result holds an empty stdout.

@param cwd where Git runs.
@param commandArguments the arguments after git.
@param options the standard input and the cancel signal.
@param readStdout consumes stdout while Git runs.
*/
export async function runGit(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
    readStdout?: StdoutReader,
): Promise<SpawnResult> {
    const command = [GIT_PROGRAM, ...commandArguments];
    const selected = await buildGitEnvironment(cwd, command, { ...options.env });
    if ('failure' in selected) return selected.failure;
    const spawn = { ...options, env: selected.variables, cwd };
    return readStdout === undefined ? runProcess(command, spawn) : streamProcess(command, spawn, readStdout);
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
    const result = await runGit(cwd, commandArguments, options, async (output) => {
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
export function isOutsideRepository(result: Pick<SpawnResult, 'code' | 'stderr'>): boolean {
    return result.code === NOT_REPOSITORY_CODE && result.stderr.startsWith(NOT_REPOSITORY_MESSAGE);
}
