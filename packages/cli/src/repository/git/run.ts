import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import {
    COPIES_FOLDER,
    GIT_COMMAND_CONFIGURATION,
    GIT_CREATION_COMMANDS,
    GIT_FLAG_ARGUMENTS,
    GIT_FOLDER_VARIABLE,
    GIT_LOCAL_VARIABLES_ARGUMENTS,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
    GIT_PATH_ARGUMENTS,
    GIT_PATH_VARIABLES,
    GIT_PROGRAM,
    GIT_SETTING_ARGUMENTS,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_VARIABLE_PREFIX,
    GIT_WORK_TREE_VARIABLE,
    TRAILING_NEWLINE,
} from '#cli/config/repository/git.ts';
import { decodeGitPaths } from '#cli/repository/git/output.ts';
import { buildSpawnEnvironment, foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import { GspotError } from '#cli/system/errors.ts';
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

export async function readGitSetting(cwd: string, key: string): Promise<string | undefined> {
    const result = await runGit(cwd, [...GIT_SETTING_ARGUMENTS, key], {});
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw buildGitError(GIT_SETTING_ARGUMENTS, result);
}

/**
Read a Git setting that holds true or false. A key with no value reads as false.
*/
export async function readGitFlag(cwd: string, key: string): Promise<boolean> {
    const result = await runGit(cwd, [...GIT_FLAG_ARGUMENTS, key], {});
    if (result.code === 0) return result.stdout.trim() === 'true';
    if (result.code === 1) return false;
    throw buildGitError(GIT_FLAG_ARGUMENTS, result);
}

export async function readGitText(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string> {
    const result = await runGit(cwd, commandArguments, options);
    if (result.code !== 0) throw buildGitError(commandArguments, result);
    return result.stdout;
}

/**
Read the absolute path of a file or folder of the Git folder, such as hooks or index.
*/
export async function readGitPath(cwd: string, name: string, cancelSignal?: AbortSignal): Promise<string> {
    const path = await readGitText(cwd, [...GIT_PATH_ARGUMENTS, name], { cancelSignal });
    return path.replace(TRAILING_NEWLINE, '');
}

export async function readGitLines(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string[]> {
    const text = await readGitText(cwd, commandArguments, options);
    return text.split('\n').filter((line) => line !== '');
}

/**
Read the records of a null-separated Git listing. A record with invalid UTF-8 is left out, and `unreadablePaths` takes
its name when the caller passes that list.

@param commandArguments the arguments after git, which must include -z.
*/
export async function readGitPaths(
    cwd: string,
    commandArguments: readonly string[],
    options: Omit<CancelableSpawnOptions, 'cwd' | 'timeoutSeconds'>,
    unreadablePaths?: string[],
): Promise<string[]> {
    const result = await runGitBytes(cwd, commandArguments, options);
    if (result.code !== 0) throw buildGitError(commandArguments, result);
    return decodeGitPaths(result.stdout, unreadablePaths);
}

export function buildGitError(
    commandArguments: readonly string[],
    result: Pick<SpawnResult, 'code' | 'stderr'>,
): GspotError {
    return new GspotError(
        'git',
        `Git ${commandArguments[0] ?? ''} failed (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}
