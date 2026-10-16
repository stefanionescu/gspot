// Runs Git commands with repository environment isolation.
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { TRAILING_NEWLINE } from '#cli/config/text.ts';
import { spawnProcess, streamProcess, spawnProcessBlocking } from '#cli/system/processes.ts';
import { normalizeEnvironmentKey, readEnvironmentVariable } from '#cli/system/environment.ts';
import type { StdoutRead, SpawnResult, SpawnOptions, ByteSpawnResult } from '#cli/types/system/processes.ts';

import type {
    GitLookup,
    GitOptions,
    GitRepository,
    GitEnvironment,
    GitTargetEnvironment,
} from '#cli/types/system/git.ts';
import {
    GIT_LOCALE,
    GIT_EXECUTABLE,
    GIT_DIR_VARIABLE,
    GIT_CLONE_COMMAND,
    GIT_PATH_VARIABLES,
    GIT_HOOKS_ARGUMENTS,
    GIT_VARIABLE_PREFIX,
    NOT_REPOSITORY_CODE,
    WORK_TREE_ARGUMENTS,
    GIT_SOURCE_ARGUMENTS,
    GIT_PREFIX_ARGUMENTS,
    GIT_FOLDER_ARGUMENTS,
    GIT_SETTING_ARGUMENTS,
    GIT_SHALLOW_ARGUMENTS,
    GIT_WORK_TREE_VARIABLE,
    NOT_REPOSITORY_MESSAGE,
    GIT_TOP_LEVEL_ARGUMENTS,
    GIT_COMMAND_CONFIGURATION,
    GIT_LOCAL_VARIABLES_ARGUMENTS,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
} from '#cli/config/system/git.ts';

// Git output defines the protocol boundary, including variable names from the installed Git version.
function parseLocalEnvironment(text: string): string[] {
    return text.replace(TRAILING_NEWLINE, '').split('\n');
}

// The hook's original working directory owns relative paths and Git's implicit worktree root.
function readInheritedGitEnvironment(origin: string): GitLookup {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = readEnvironmentVariable(name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = spawnProcessBlocking(['git', ...GIT_SOURCE_ARGUMENTS], {
        cwd: origin,
        env: env,
    });
    if (source.code !== 0) return { failure: source };
    const line = source.stdout.indexOf('\n');
    const isBare = source.stdout.slice(0, line) === 'true';
    const folder = trimGitLine(source.stdout.slice(line + 1));
    if (
        !isBare &&
        readEnvironmentVariable(GIT_DIR_VARIABLE) !== undefined &&
        readEnvironmentVariable(GIT_WORK_TREE_VARIABLE) === undefined
    ) {
        const worktree = spawnProcessBlocking(['git', ...GIT_TOP_LEVEL_ARGUMENTS], {
            cwd: origin,
            env: env,
        });
        if (worktree.code !== 0) return { failure: worktree };
        env[GIT_WORK_TREE_VARIABLE] = trimGitLine(worktree.stdout);
    }
    return { folder: folder, env };
}

// The target's own metadata decides whether inherited repository-local variables remain valid.
function readTargetGitEnvironment(
    root: string,
    source: GitRepository,
    environment: GitTargetEnvironment,
): GitEnvironment {
    const { isolated, overrides, explicit } = environment;
    const target = spawnProcessBlocking(['git', ...GIT_FOLDER_ARGUMENTS], {
        cwd: root,
        env: { ...isolated, ...overrides, ...GIT_LOCALE },
    });
    if (isOutsideGit(target)) return { env: { ...isolated, ...explicit } };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = realpathSync(source.folder) === realpathSync(trimGitLine(target.stdout));
    return { env: { ...(isSameRepository ? source.env : isolated), ...explicit } };
}

/**
 * Distinguishes an absent work tree from broken Git metadata after a failed command.
 * @param inspection the work-tree probe result.
 * @returns true when Git reports that no repository exists.
 */
function isOutsideGit(inspection: SpawnResult): boolean {
    return inspection.code === NOT_REPOSITORY_CODE && inspection.stderr.startsWith(NOT_REPOSITORY_MESSAGE);
}

let sourceMetadata: { metadata: string[]; source?: GitLookup } | undefined;

/**
 * Git identifies local variables and worktree-specific metadata. Explicit caller settings apply last.
 * @param workingFolder the repository directory.
 * @param commandArguments the literal Git command arguments.
 * @param explicit the environment overrides for this command.
 * @returns the environment for the requested Git command.
 */
export function buildGitEnvironment(
    workingFolder: string,
    commandArguments: readonly string[],
    explicit: Record<string, string | undefined>,
): GitEnvironment {
    if (
        // eslint-disable-next-line n/no-process-env -- reason: Git scans variable names to isolate repository-local settings.
        !Object.keys(process.env).some((key) => {
            const name = normalizeEnvironmentKey(key);
            return name.startsWith(GIT_VARIABLE_PREFIX) && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name);
        })
    )
        return { env: explicit };
    const origin = process.cwd();
    if (sourceMetadata === undefined) {
        const declared = spawnProcessBlocking(['git', ...GIT_LOCAL_VARIABLES_ARGUMENTS], { cwd: origin, env: {} });
        if (declared.code !== 0) return { failure: declared };
        const metadata = parseLocalEnvironment(declared.stdout).filter((name) => !GIT_COMMAND_CONFIGURATION.has(name));
        sourceMetadata = { metadata };
    }
    const { metadata } = sourceMetadata;
    if (!metadata.some((name) => readEnvironmentVariable(name) !== undefined)) return { env: explicit };
    const isolated = Object.fromEntries(metadata.map((name) => [name, undefined]));
    if ([GIT_EXECUTABLE, GIT_CLONE_COMMAND].every((part, index) => commandArguments[index] === part))
        return { env: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(
        Object.entries(explicit).filter(([name]) => !metadata.includes(normalizeEnvironmentKey(name))),
    );
    const source = (sourceMetadata.source ??= readInheritedGitEnvironment(origin));
    if ('failure' in source) return source;
    return readTargetGitEnvironment(workingFolder, source, { isolated, overrides, explicit });
}

/**
 * Run Git without a time limit and wait for its result.
 * @param workingFolder the working directory.
 * @param commandArguments the arguments after git.
 * @param options the other spawn options, such as the environment.
 * @returns what Git printed and how it exited.
 */
export function runGitBlocking(
    workingFolder: string,
    commandArguments: readonly string[],
    options: Omit<SpawnOptions, 'cwd' | 'timeoutSeconds'> = {},
): SpawnResult {
    const selected = buildGitEnvironment(workingFolder, ['git', ...commandArguments], { ...options.env });
    if ('failure' in selected) return selected.failure;
    return spawnProcessBlocking(['git', ...commandArguments], { ...options, env: selected.env, cwd: workingFolder });
}

/**
 * Runs Git with cancellation.
 * @param workingFolder the working directory.
 * @param commandArguments the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @param output the declared output format.
 * @returns what Git printed and how it exited.
 */
export async function runGit(
    workingFolder: string,
    commandArguments: readonly string[],
    options: GitOptions,
    output: StdoutRead = 'utf8',
): Promise<SpawnResult> {
    const selected = buildGitEnvironment(workingFolder, ['git', ...commandArguments], { ...options.env });
    if ('failure' in selected) return selected.failure;
    const command = ['git', ...commandArguments];
    const prepared = { ...options, env: selected.env, cwd: workingFolder };
    return output === 'utf8' ? spawnProcess(command, prepared) : streamProcess(command, prepared, output);
}

/**
 * Runs Git with cancellation and keeps output bytes for paths and objects.
 * @param workingFolder the working directory.
 * @param commandArguments the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @returns the bytes Git printed and how it exited.
 */
export async function runGitForBytes(
    workingFolder: string,
    commandArguments: readonly string[],
    options: GitOptions,
): Promise<ByteSpawnResult> {
    const chunks: Buffer[] = [];
    const result = await runGit(workingFolder, commandArguments, options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}

/**
 * Reads a Git configuration value, distinguishing an unset key from a failed command.
 * @param workingFolder the working directory.
 * @param key the configuration key.
 * @returns the exact value, or undefined for an unset key.
 */
export function readGitSetting(workingFolder: string, key: string): string | undefined {
    const result = runGitBlocking(workingFolder, [...GIT_SETTING_ARGUMENTS, key]);
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw new Error(
        `Git configuration ${key} failed in ${workingFolder} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}

/**
 * The folder Git runs hooks from: core.hooksPath when set, otherwise the hooks folder of the Git directory.
 * @param workingFolder the repository root.
 * @returns the absolute path.
 */
export function readHooksFolder(workingFolder: string): string {
    const result = runGitBlocking(workingFolder, GIT_HOOKS_ARGUMENTS);
    if (result.code !== 0) throw new Error(`Cannot read the Git hooks folder: ${result.stderr.trim()}`);
    return resolve(workingFolder, trimGitLine(result.stdout));
}

/**
 * What a Git command prints, or the selection error it failed with.
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git.
 * @param options cancellation and input.
 * @returns the standard output as printed.
 */
export async function readGitText(
    workingFolder: string,
    commandArguments: readonly string[],
    options: GitOptions,
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
 * A Git command's output as its non-empty lines.
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git.
 * @param options cancellation and input.
 * @returns the lines, in order.
 */
export async function readGitLines(
    workingFolder: string,
    commandArguments: readonly string[],
    options: GitOptions,
): Promise<string[]> {
    const text = await readGitText(workingFolder, commandArguments, options);
    return text.split('\n').filter((line) => line !== '');
}

/**
 * The paths a null-separated Git listing names.
 * @param workingFolder the repository root.
 * @param commandArguments the arguments after git, which must include -z.
 * @param options cancellation and input.
 * @returns the paths, in order.
 */
export async function readGitPaths(
    workingFolder: string,
    commandArguments: readonly string[],
    options: GitOptions,
): Promise<string[]> {
    const text = await readGitText(workingFolder, commandArguments, options);
    return text.split('\0').filter((path) => path !== '');
}

/**
 * Whether a shallow clone cuts repository history.
 * @param workingFolder the repository root.
 * @param options cancellation and input.
 * @returns true for a shallow repository.
 */
export async function isShallow(workingFolder: string, options: GitOptions): Promise<boolean> {
    const answer = await readGitText(workingFolder, GIT_SHALLOW_ARGUMENTS, options);
    return answer.trim() === 'true';
}

/**
 * The path from Git's top level to the project root, with a trailing slash.
 * @param workingFolder the repository directory.
 * @returns the repository-relative prefix for this directory.
 */
export function readGitPrefix(workingFolder: string): string {
    const result = runGitBlocking(workingFolder, GIT_PREFIX_ARGUMENTS);
    if (result.code !== 0) throw new GspotError('git', `Cannot read the Git path prefix: ${result.stderr.trim()}`);
    return trimGitLine(result.stdout);
}

/**
 * Remove the final newline from a Git result while preserving the value's other bytes.
 * @param text Git's printed value.
 * @returns the value without its final newline.
 */
export function trimGitLine(text: string): string {
    return text.replace(TRAILING_NEWLINE, '');
}

/**
 * True when a Git work tree contains the root.
 * @param workingFolder the directory.
 * @returns whether Git confirms a work tree.
 * @throws when Git cannot establish the repository state.
 */
export function isGitRepository(workingFolder: string): boolean {
    const inspection = runGitBlocking(workingFolder, WORK_TREE_ARGUMENTS, { env: GIT_LOCALE });
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (isOutsideGit(inspection)) return false;
    throw new Error(
        `Git work-tree discovery failed in ${workingFolder} (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}
