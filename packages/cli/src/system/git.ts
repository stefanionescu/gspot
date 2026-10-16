// Runs Git commands with repository environment isolation.
// Runs Git commands with repository environment isolation.
import { resolve } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { TRAILING_NEWLINE } from '#cli/config/text.ts';
import { run, runBlocking } from '#cli/system/processes.ts';
import { realPath } from '#cli/system/safe-folder/reads.ts';
import { environmentVariable, environmentVariables } from '#cli/system/environment.ts';
import type { StdoutRead, SpawnResult, SpawnOptions, ByteSpawnResult } from '#cli/types/system/processes.ts';

import type {
    GitSource,
    GitOptions,
    GitRepository,
    GitEnvironment,
    GitTargetEnvironment,
} from '#cli/types/system/git.ts';
import {
    GIT_LOCALE,
    GIT_HOOKS_ARGV,
    GIT_EXECUTABLE,
    GIT_SOURCE_ARGV,
    GIT_SETTING_ARGV,
    GIT_SHALLOW_ARGV,
    GIT_DIR_VARIABLE,
    GIT_CLONE_COMMAND,
    GIT_DIRECTORY_ARGV,
    GIT_PATH_VARIABLES,
    GIT_TOP_LEVEL_ARGV,
    GIT_VARIABLE_PREFIX,
    NOT_REPOSITORY_CODE,
    GIT_PREFIX_ARGUMENTS,
    GIT_WORK_TREE_VARIABLE,
    NOT_REPOSITORY_MESSAGE,
    GIT_LOCAL_VARIABLES_ARGV,
    GIT_COMMAND_CONFIGURATION,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
} from '#cli/config/system/git.ts';

// Git output defines the protocol boundary, including variable names from the installed Git version.
function parseLocalEnvironment(text: string): string[] {
    return text.replace(TRAILING_NEWLINE, '').split('\n');
}

// The hook's original working directory owns relative paths and Git's implicit worktree root.
function sourceGitEnvironment(
    inherited: Record<string, string>,
    origin: string,
    overrides: Record<string, string | undefined>,
): GitSource {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = environmentVariable(inherited, name);
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = runBlocking(['git', ...GIT_SOURCE_ARGV], { cwd: origin, env: { ...env, ...overrides } });
    if (source.code !== 0) return { failure: source };
    const line = source.stdout.indexOf('\n');
    const isBare = source.stdout.slice(0, line) === 'true';
    const directory = gitLine(source.stdout.slice(line + 1));
    if (
        !isBare &&
        environmentVariable(inherited, GIT_DIR_VARIABLE) !== undefined &&
        environmentVariable(inherited, GIT_WORK_TREE_VARIABLE) === undefined
    ) {
        const worktree = runBlocking(['git', ...GIT_TOP_LEVEL_ARGV], {
            cwd: origin,
            env: { ...env, ...overrides },
        });
        if (worktree.code !== 0) return { failure: worktree };
        env[GIT_WORK_TREE_VARIABLE] = gitLine(worktree.stdout);
    }
    return { directory, env };
}

// The target's own metadata decides whether inherited repository-local variables remain valid.
function targetGitEnvironment(root: string, source: GitRepository, environment: GitTargetEnvironment): GitEnvironment {
    const { isolated, overrides, explicit } = environment;
    const target = runBlocking(['git', ...GIT_DIRECTORY_ARGV], {
        cwd: root,
        env: { ...isolated, ...overrides, ...GIT_LOCALE },
    });
    if (isOutsideGit(target)) return { env: { ...isolated, ...explicit } };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = realPath(source.directory) === realPath(gitLine(target.stdout));
    return { env: { ...(isSameRepository ? source.env : isolated), ...explicit } };
}

let sourceMetadata: { metadata: string[]; source?: GitSource } | undefined;

/**
 * Git identifies local variables and worktree-specific metadata. Explicit caller settings apply last.
 * @param root the repository directory.
 * @param argv the literal Git command arguments.
 * @param explicit the environment overrides for this command.
 * @returns the environment for the requested Git command.
 */
// eslint-disable-next-line complexity -- reason: Git environment isolation combines source-repository identity and command overrides; splitting it adds one-caller wrappers.
export function gitEnvironment(
    root: string,
    argv: readonly string[],
    explicit: Record<string, string | undefined>,
): GitEnvironment {
    const inherited = environmentVariables();
    if (
        !Object.keys(inherited).some((key) => {
            const name = process.platform === 'win32' ? key.toUpperCase() : key;
            return name.startsWith(GIT_VARIABLE_PREFIX) && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name);
        })
    )
        return { env: explicit };
    const origin = process.cwd();
    if (sourceMetadata === undefined) {
        const declared = runBlocking(['git', ...GIT_LOCAL_VARIABLES_ARGV], { cwd: origin, env: {} });
        if (declared.code !== 0) return { failure: declared };
        const metadata = parseLocalEnvironment(declared.stdout).filter(
            (name) => !new Set<string | undefined>(GIT_COMMAND_CONFIGURATION).has(name),
        );
        sourceMetadata = { metadata };
    }
    const { metadata } = sourceMetadata;
    if (!metadata.some((name) => environmentVariable(inherited, name) !== undefined)) return { env: explicit };
    const isolated = Object.fromEntries(metadata.map((name) => [name, undefined]));
    if (argv[0] === GIT_EXECUTABLE && argv[1] === GIT_CLONE_COMMAND) return { env: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(
        Object.entries(explicit).filter(
            ([name]) => !metadata.includes(process.platform === 'win32' ? name.toUpperCase() : name),
        ),
    );
    const source = (sourceMetadata.source ??= sourceGitEnvironment(inherited, origin, {}));
    if ('failure' in source) return source;
    return targetGitEnvironment(root, source, { isolated, overrides, explicit });
}
/**
 * Distinguishes an absent work tree from broken Git metadata after a failed command.
 * @param inspection the work-tree probe result.
 * @returns true when Git reports that no repository exists.
 */
export function isOutsideGit(inspection: SpawnResult): boolean {
    return inspection.code === NOT_REPOSITORY_CODE && inspection.stderr.startsWith(NOT_REPOSITORY_MESSAGE);
}
/**
 * Run Git without a time limit and wait for its result.
 * @param root the working directory.
 * @param argv the arguments after git.
 * @param options the other spawn options, such as the environment.
 * @returns what Git printed and how it exited.
 */
export function runGitBlocking(
    root: string,
    argv: readonly string[],
    options: Omit<SpawnOptions, 'cwd' | 'timeoutMs'> = {},
): SpawnResult {
    const selected = gitEnvironment(root, ['git', ...argv], { ...options.env });
    if ('failure' in selected) return selected.failure;
    return runBlocking(['git', ...argv], { ...options, env: selected.env, cwd: root });
}
/**
 * Runs Git with cancellation.
 * @param root the working directory.
 * @param argv the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @param output the declared output format.
 * @returns what Git printed and how it exited.
 */
export async function runGit(
    root: string,
    argv: readonly string[],
    options: GitOptions = {},
    output: StdoutRead = 'utf8',
): Promise<SpawnResult> {
    const selected = gitEnvironment(root, ['git', ...argv], { ...options.env });
    if ('failure' in selected) return selected.failure;
    return run(['git', ...argv], { ...options, env: selected.env, cwd: root }, output);
}
/**
 * Runs Git with cancellation and keeps output bytes for paths and objects.
 * @param root the working directory.
 * @param argv the arguments after git.
 * @param options spawn settings for standard input and optional cancellation.
 * @returns the bytes Git printed and how it exited.
 */
export async function runGitForBytes(
    root: string,
    argv: readonly string[],
    options: GitOptions = {},
): Promise<ByteSpawnResult> {
    const chunks: Buffer[] = [];
    const result = await runGit(root, argv, options, async (output) => {
        for await (const chunk of output) chunks.push(chunk);
    });
    return { ...result, stdout: Buffer.concat(chunks) };
}
/**
 * Reads a Git configuration value, distinguishing an unset key from a failed command.
 * @param root the working directory.
 * @param key the configuration key.
 * @returns the exact value, or undefined for an unset key.
 */
export function readGitSetting(root: string, key: string): string | undefined {
    const result = runGitBlocking(root, [...GIT_SETTING_ARGV, key]);
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw new Error(
        `Git configuration ${key} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}
/**
 * The folder Git runs hooks from: core.hooksPath when set, otherwise the hooks folder of the Git directory.
 * @param root the repository root.
 * @returns the absolute path.
 */
export function hooksDirectory(root: string): string {
    const result = runGitBlocking(root, [...GIT_HOOKS_ARGV]);
    if (result.code !== 0) throw new Error(`Cannot read the Git hooks folder: ${result.stderr.trim()}`);
    return resolve(root, gitLine(result.stdout));
}
/**
 * What a Git command prints, or the selection error it failed with.
 * @param root the repository root.
 * @param argv the arguments after git.
 * @param options cancellation and input.
 * @returns the standard output as printed.
 */
export async function gitText(root: string, argv: readonly string[], options: GitOptions = {}): Promise<string> {
    const result = await runGit(root, argv, options);
    if (result.code !== 0)
        throw new GspotError(
            'git',
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        );
    return result.stdout;
}
/**
 * A Git command's output as its non-empty lines.
 * @param root the repository root.
 * @param argv the arguments after git.
 * @param options cancellation and input.
 * @returns the lines, in order.
 */
export async function gitLines(root: string, argv: readonly string[], options: GitOptions = {}): Promise<string[]> {
    const text = await gitText(root, argv, options);
    return text.split('\n').filter((line) => line !== '');
}
/**
 * The paths a null-separated Git listing names.
 * @param root the repository root.
 * @param argv the arguments after git, which must include -z.
 * @param options cancellation and input.
 * @returns the paths, in order.
 */
export async function gitPaths(root: string, argv: readonly string[], options: GitOptions = {}): Promise<string[]> {
    const text = await gitText(root, argv, options);
    return text.split('\0').filter((path) => path !== '');
}
/**
 * Whether a shallow clone cuts repository history.
 * @param root the repository root.
 * @param options cancellation and input.
 * @returns true for a shallow repository.
 */
export async function isShallow(root: string, options: GitOptions = {}): Promise<boolean> {
    const answer = await gitText(root, [...GIT_SHALLOW_ARGV], options);
    return answer.trim() === 'true';
}
/**
 * The path from Git's top level to the project root, with a trailing slash.
 * @param root the repository directory.
 * @param hasGit whether the directory belongs to a Git repository.
 * @returns the repository-relative prefix for this directory.
 */
export function gitPrefix(root: string, hasGit: boolean): string {
    if (!hasGit) return '';
    const result = runGitBlocking(root, GIT_PREFIX_ARGUMENTS);
    if (result.code !== 0) throw new GspotError('git', `Cannot find the hook directory: ${result.stderr.trim()}`);
    return gitLine(result.stdout);
}
/**
 * Remove the final newline from a Git result while preserving the value's other bytes.
 * @param text Git's printed value.
 * @returns the value without its final newline.
 */
export function gitLine(text: string): string {
    return text.replace(TRAILING_NEWLINE, '');
}

/**
 * Find the working tree's top-level folder through Git.
 * @param root the working directory.
 * @param options cancellation and input.
 * @returns the top-level folder.
 */
export async function gitTopLevel(root: string, options: GitOptions = {}): Promise<string> {
    return gitLine(await gitText(root, [...GIT_TOP_LEVEL_ARGV], options));
}
