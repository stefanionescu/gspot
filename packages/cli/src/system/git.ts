// Runs Git commands with repository environment isolation.
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';
import { spawnProcess, streamProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import type { GitLookup, GitRepository, GitEnvironment, GitTargetEnvironment } from '#cli/types/system/git.ts';

import {
    type SpawnResult,
    type SpawnOptions,
    type StdoutReader,
    type AsyncSpawnOptions,
} from '#cli/types/system/processes.ts';
import {
    GIT_LOCALE,
    GIT_EXECUTABLE,
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

// The original working folder of the hook decides relative paths and the implicit Git worktree root.
function readInheritedGitEnvironment(origin: string): GitLookup {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = readEnvironmentVariable(name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = spawnProcessBlocking([GIT_EXECUTABLE, ...GIT_SOURCE_ARGUMENTS], {
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
        const worktree = spawnProcessBlocking([GIT_EXECUTABLE, ...GIT_TOP_LEVEL_ARGUMENTS], {
            cwd: origin,
            env,
        });
        if (worktree.code !== 0) return { failure: worktree };
        env[GIT_WORK_TREE_VARIABLE] = worktree.stdout.replace(TRAILING_NEWLINE, '');
    }
    return { folder, env };
}

// The metadata of the target decides whether inherited repository-local variables stay valid.
function readTargetGitEnvironment(
    root: string,
    source: GitRepository,
    environment: GitTargetEnvironment,
): GitEnvironment {
    const { isolated, overrides, explicit } = environment;
    const target = spawnProcessBlocking([GIT_EXECUTABLE, ...GIT_FOLDER_ARGUMENTS], {
        cwd: root,
        env: { ...isolated, ...overrides, ...GIT_LOCALE },
    });
    // Git reports that no repository holds the folder.
    if (target.code === NOT_REPOSITORY_CODE && target.stderr.startsWith(NOT_REPOSITORY_MESSAGE))
        return { env: { ...isolated, ...explicit } };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = realpathSync(source.folder) === realpathSync(target.stdout.replace(TRAILING_NEWLINE, ''));
    return { env: { ...(isSameRepository ? source.env : isolated), ...explicit } };
}

/**
 * Build the environment for one Git command. Git names the local variables and worktree metadata;
 * the caller overrides apply last.
 *
 * @param workingFolder the repository folder.
 * @param commandArguments everything after `git`, literally.
 * @param explicit the environment overrides for this command.
 * @returns the environment for the requested Git command.
 */
export function readGitEnvironment(
    workingFolder: string,
    commandArguments: readonly string[],
    explicit: Record<string, string | undefined>,
): GitEnvironment {
    if (
        !Object.keys(buildSpawnEnvironment()).some((key) => {
            const name = process.platform === 'win32' ? key.toUpperCase() : key;
            return name.startsWith(GIT_VARIABLE_PREFIX) && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name);
        })
    )
        return { env: explicit };
    const origin = process.cwd();
    if (inheritedGit === undefined) {
        const declared = spawnProcessBlocking([GIT_EXECUTABLE, ...GIT_LOCAL_VARIABLES_ARGUMENTS], {
            cwd: origin,
            env: {},
        });
        if (declared.code !== 0) return { failure: declared };
        // The installed Git version lists its own local variable names.
        const localVariables = declared.stdout
            .replace(TRAILING_NEWLINE, '')
            .split('\n')
            .filter((name) => !GIT_COMMAND_CONFIGURATION.has(name));
        inheritedGit = { localVariables };
    }
    const { localVariables } = inheritedGit;
    if (!localVariables.some((name) => readEnvironmentVariable(name) !== undefined)) return { env: explicit };
    const isolated = Object.fromEntries(localVariables.map((name) => [name, undefined]));
    if ([GIT_EXECUTABLE, GIT_CLONE_COMMAND].every((part, index) => commandArguments[index] === part))
        return { env: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(
        Object.entries(explicit).filter(
            ([name]) => !localVariables.includes(process.platform === 'win32' ? name.toUpperCase() : name),
        ),
    );
    const repository = (inheritedGit.repository ??= readInheritedGitEnvironment(origin));
    if ('failure' in repository) return repository;
    return readTargetGitEnvironment(workingFolder, repository, { isolated, overrides, explicit });
}

/**
 * Run Git without a time limit and wait for its result.
 *
 * @param workingFolder where Git runs.
 * @param commandArguments the arguments after git.
 * @param options the other spawn settings, such as the environment.
 * @returns what Git printed and how it exited.
 */
export function runGitBlocking(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<SpawnOptions, 'cwd' | 'timeoutSeconds'> = {},
): SpawnResult {
    const selected = readGitEnvironment(workingFolder, [GIT_EXECUTABLE, ...commandArguments], { ...options.env });
    if ('failure' in selected) return selected.failure;
    return spawnProcessBlocking([GIT_EXECUTABLE, ...commandArguments], {
        ...options,
        env: selected.env,
        cwd: workingFolder,
    });
}

/**
 * Run Git with cancellation.
 *
 * @param workingFolder where Git runs.
 * @param commandArguments the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @returns what Git printed and how it exited.
 */
export async function runGit(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<SpawnResult> {
    const selected = readGitEnvironment(workingFolder, [GIT_EXECUTABLE, ...commandArguments], { ...options.env });
    if ('failure' in selected) return selected.failure;
    const command = [GIT_EXECUTABLE, ...commandArguments];
    const prepared = { ...options, env: selected.env, cwd: workingFolder };
    return spawnProcess(command, prepared);
}

/**
 * Stream Git output with repository isolation and optional cancellation.
 *
 * @param workingFolder where Git runs.
 * @param commandArguments the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @param read consumes stdout while Git runs.
 * @returns the captured stderr and exit status.
 */
export async function runGitStream(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
    read: StdoutReader,
): Promise<SpawnResult> {
    const selected = readGitEnvironment(workingFolder, [GIT_EXECUTABLE, ...commandArguments], { ...options.env });
    if ('failure' in selected) return selected.failure;
    return streamProcess(
        [GIT_EXECUTABLE, ...commandArguments],
        { ...options, env: selected.env, cwd: workingFolder },
        read,
    );
}

/**
 * Run Git with cancellation, and keep the output bytes for paths and objects.
 *
 * @param workingFolder where Git runs.
 * @param commandArguments the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @returns the bytes Git printed and how it exited.
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
 * Read a Git setting, and tell an unset key from a failed command.
 *
 * @param workingFolder where Git runs.
 * @param key the Git setting name.
 * @returns the exact value, or undefined for an unset key.
 */
export function readGitSetting(workingFolder: string, key: string): string | undefined {
    const result = runGitBlocking(workingFolder, [...GIT_SETTING_ARGUMENTS, key]);
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw new GspotError(
        'git',
        `Git ${GIT_SETTING_ARGUMENTS[0]} failed in ${workingFolder} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}

/**
 * Find the folder that Git runs hooks from: core.hooksPath when set, else the hooks folder of the Git folder.
 *
 * @param workingFolder the repository root.
 * @returns the absolute path.
 */
export function readHooksFolder(workingFolder: string): string {
    const result = runGitBlocking(workingFolder, GIT_HOOKS_ARGUMENTS);
    if (result.code !== 0)
        throw new GspotError(
            'git',
            `Git ${GIT_HOOKS_ARGUMENTS[0]} failed in ${workingFolder} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        );
    return resolve(workingFolder, result.stdout.replace(TRAILING_NEWLINE, ''));
}

/**
 * Read what a Git command prints, or the selection error that it failed with.
 *
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git.
 * @param options cancellation and input.
 * @returns the standard output as printed.
 */
export async function readGitText(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<AsyncSpawnOptions, 'cwd' | 'timeoutSeconds'>,
): Promise<string> {
    const result = await runGit(workingFolder, commandArguments, options);
    if (result.code !== 0)
        throw new GspotError(
            'git',
            `Git ${commandArguments[0] ?? ''} failed in ${workingFolder} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        );
    return result.stdout;
}

/**
 * Read the non-empty output lines of a Git command.
 *
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git.
 * @param options cancellation and input.
 * @returns the lines, in order.
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
 * Read the paths that a null-separated Git listing names.
 *
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git, which must include -z.
 * @param options cancellation and input.
 * @returns the paths, in order.
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
 * Check whether a Git work tree contains the folder.
 *
 * @param workingFolder the folder to test.
 * @returns whether Git confirms a work tree.
 * @throws when Git cannot establish the repository state.
 */
export function isGitRepository(workingFolder: string): boolean {
    const inspection = runGitBlocking(workingFolder, GIT_WORK_TREE_ARGUMENTS, { env: GIT_LOCALE });
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (inspection.code === NOT_REPOSITORY_CODE && inspection.stderr.startsWith(NOT_REPOSITORY_MESSAGE)) return false;
    throw new GspotError(
        'git',
        `Git ${GIT_WORK_TREE_ARGUMENTS[0]} failed in ${workingFolder} (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}
