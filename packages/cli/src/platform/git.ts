// The Git commands gspot runs: configuration reads, the hooks folder, and the queries of the revision code.
import { lstatSync } from 'node:fs';
import { GspotError } from '#cli/platform/errors.ts';
import { canonicalPath } from '#cli/platform/root/reads.ts';
import { join, dirname, resolve, basename } from 'node:path';
import { environmentVariables } from '#cli/platform/environment.ts';
import { run, runBinary, runBlocking } from '#cli/platform/spawn.ts';
import type { GitOptions, SpawnResult, SpawnOptions, BinarySpawnResult } from '#cli/types/platform/runtime.ts';

import type {
    GitSource,
    GitDiscovery,
    GitRepository,
    GitEnvironment,
    GitTargetEnvironment,
} from '#cli/types/platform/git.ts';
import {
    GIT_TIMEOUT_MS,
    GIT_EXECUTABLES,
    GIT_PATH_VARIABLES,
    NOT_REPOSITORY_CODE,
    GIT_ENVIRONMENT_NAME,
    GIT_CREATION_COMMANDS,
    GIT_COMMAND_CONFIGURATION,
    GIT_NONLOCAL_ENVIRONMENT_NAME,
} from '#cli/config/platform/git.ts';

function hasGitEntry(directory: string): boolean {
    try {
        lstatSync(join(directory, '.git'));
        return true;
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    const parent = dirname(directory);
    return parent !== directory && hasGitEntry(parent);
}

// Git's output is a protocol boundary, including variable names from the installed Git version.
function parseLocalEnvironment(text: string): string[] {
    const local = text.replace(/\n$/u, '').split('\n');
    if (!local.includes('GIT_DIR') || local.some((name) => !GIT_ENVIRONMENT_NAME.test(name)))
        throw new GspotError('selection', 'Git did not report valid local environment variable names.');
    return local;
}

// The hook's original working directory owns relative paths and Git's implicit worktree root.
function* sourceGitEnvironment(
    inherited: Record<string, string>,
    origin: string,
    overrides: Record<string, string | undefined>,
): Generator<GitDiscovery, GitSource, SpawnResult> {
    const env = Object.fromEntries(
        GIT_PATH_VARIABLES.flatMap((name) => {
            const value = inherited[name];
            return value === undefined ? [] : [[name, resolve(origin, value)]];
        }),
    );
    const source = yield {
        cwd: origin,
        argv: ['rev-parse', '--is-bare-repository', '--absolute-git-dir'],
        env: { ...env, ...overrides },
    };
    if (source.code !== 0) return { failure: source };
    const line = source.stdout.indexOf('\n');
    const bare = source.stdout.slice(0, line);
    if (bare !== 'true' && bare !== 'false')
        throw new GspotError('selection', 'Git did not report a valid repository kind.');
    const directory = source.stdout.slice(line + 1).replace(/\n$/u, '');
    if (bare === 'false' && inherited['GIT_DIR'] !== undefined && inherited['GIT_WORK_TREE'] === undefined) {
        const worktree = yield {
            cwd: origin,
            argv: ['rev-parse', '--show-toplevel'],
            env: { ...env, ...overrides },
        };
        if (worktree.code !== 0) return { failure: worktree };
        env['GIT_WORK_TREE'] = worktree.stdout.replace(/\n$/u, '');
    }
    return { directory, env };
}

// The target's own metadata decides whether inherited repository-local variables remain valid.
function* targetGitEnvironment(
    root: string,
    source: GitRepository,
    environment: GitTargetEnvironment,
): Generator<GitDiscovery, GitEnvironment, SpawnResult> {
    const { isolated, overrides, explicit } = environment;
    const target = yield {
        cwd: root,
        argv: ['rev-parse', '--absolute-git-dir'],
        env: { ...isolated, ...overrides, LC_ALL: 'C' },
    };
    if (isOutsideGit(root, target)) return { env: { ...isolated, ...explicit } };
    if (target.code !== 0) return { failure: target };
    const isSameRepository = canonicalPath(source.directory) === canonicalPath(target.stdout.replace(/\n$/u, ''));
    return { env: { ...(isSameRepository ? source.env : isolated), ...explicit } };
}

// Native Git identifies local variables and worktree-specific metadata; explicit caller settings apply last.
function* gitEnvironment(
    root: string,
    argv: string[],
    explicit: Record<string, string | undefined>,
): Generator<GitDiscovery, GitEnvironment, SpawnResult> {
    const inherited = environmentVariables();
    if (!Object.keys(inherited).some((name) => name.startsWith('GIT_') && !GIT_NONLOCAL_ENVIRONMENT_NAME.test(name)))
        return { env: explicit };
    const origin = process.cwd();
    const declared = yield { cwd: origin, argv: ['rev-parse', '--local-env-vars'], env: explicit };
    if (declared.code !== 0) return { failure: declared };
    const local = parseLocalEnvironment(declared.stdout);
    const metadata = local.filter((name) => !GIT_COMMAND_CONFIGURATION.includes(name));
    if (!metadata.some((name) => inherited[name] !== undefined)) return { env: explicit };
    const isolated = Object.fromEntries(metadata.map((name) => [name, undefined]));
    if (GIT_EXECUTABLES.has(basename(argv[0] ?? '')) && GIT_CREATION_COMMANDS.has(argv[1]))
        return { env: { ...isolated, ...explicit } };
    const overrides = Object.fromEntries(Object.entries(explicit).filter(([name]) => !metadata.includes(name)));
    const source = yield* sourceGitEnvironment(inherited, origin, overrides);
    if ('failure' in source) return source;
    return yield* targetGitEnvironment(root, source, { isolated, overrides, explicit });
}

/**
 * Distinguishes an absent work tree from broken Git metadata after a failed command.
 * @param root the inspected directory
 * @param inspection the work-tree probe result
 * @returns true only when Git and the ancestor metadata agree that no repository exists
 */
export function isOutsideGit(root: string, inspection: SpawnResult): boolean {
    return (
        inspection.code === NOT_REPOSITORY_CODE &&
        inspection.stderr.startsWith('fatal: not a git repository (or any ') &&
        !hasGitEntry(resolve(root))
    );
}

/**
 * Resolves repository-local Git metadata for a process rooted in its own directory.
 * @param root the process working directory
 * @param argv the full executable argument vector
 * @param options explicit environment, deadline, and cancellation
 * @returns the environment or the original native discovery failure
 */
export async function getGitEnvironment(root: string, argv: string[], options: GitOptions): Promise<GitEnvironment> {
    const discovery = gitEnvironment(root, argv, { ...options.env });
    let step = discovery.next();
    while (step.done !== true) {
        const result = await run(['git', ...step.value.argv], {
            timeoutMs: options.timeoutMs ?? GIT_TIMEOUT_MS,
            cancelSignal: options.cancelSignal,
            cwd: step.value.cwd,
            env: step.value.env,
        });
        step = discovery.next(result);
    }
    return step.value;
}

/**
 * Runs Git and waits for it, with the one Git deadline.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as the environment
 * @returns what Git printed and how it exited
 */
export function runGitBlocking(root: string, argv: string[], options: Omit<SpawnOptions, 'cwd'> = {}): SpawnResult {
    const discovery = gitEnvironment(root, ['git', ...argv], { ...options.env });
    let step = discovery.next();
    while (step.done !== true) {
        const result = runBlocking(['git', ...step.value.argv], {
            timeoutMs: options.timeoutMs ?? GIT_TIMEOUT_MS,
            cwd: step.value.cwd,
            env: step.value.env,
        });
        step = discovery.next(result);
    }
    if ('failure' in step.value) return step.value.failure;
    return runBlocking(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, env: step.value.env, cwd: root });
}

/**
 * Runs Git with the one Git deadline.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as standard input and a cancellation that may be absent
 * @returns what Git printed and how it exited
 */
export async function runGit(root: string, argv: string[], options: GitOptions = {}): Promise<SpawnResult> {
    const selected = await getGitEnvironment(root, ['git', ...argv], options);
    if ('failure' in selected) return selected.failure;
    return run(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, env: selected.env, cwd: root });
}

/**
 * Runs Git with the one Git deadline and keeps its output as bytes, for paths and objects that need not be UTF-8.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as standard input and a cancellation that may be absent
 * @returns the bytes Git printed and how it exited
 */
export async function runGitBinary(root: string, argv: string[], options: GitOptions = {}): Promise<BinarySpawnResult> {
    const selected = await getGitEnvironment(root, ['git', ...argv], options);
    if ('failure' in selected) return { ...selected.failure, stdout: Buffer.from(selected.failure.stdout) };
    return runBinary(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, env: selected.env, cwd: root });
}

/**
 * Reads a Git configuration value, distinguishing an unset key from a failed command.
 * @param root the working directory
 * @param key the configuration key
 * @returns the exact value, or undefined when the key is unset
 */
export function readGitSetting(root: string, key: string): string | undefined {
    const result = runGitBlocking(root, ['config', '--null', '--get', key]);
    if (result.code === 0) return result.stdout.slice(0, -1);
    if (result.code === 1 && result.stdout === '' && result.stderr === '') return undefined;
    throw new Error(
        `Git configuration ${key} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
    );
}

/**
 * The folder Git runs hooks from: core.hooksPath when set, otherwise the hooks folder of the Git directory.
 * @param root the repository root
 * @returns the absolute path
 */
export function hooksDirectory(root: string): string {
    const result = runGitBlocking(root, ['rev-parse', '--git-path', 'hooks']);
    if (result.code !== 0) throw new Error(`Cannot resolve the Git hooks folder: ${result.stderr.trim()}`);
    return resolve(root, result.stdout.replace(/\n$/u, ''));
}

/**
 * What a Git command prints, or the selection error it failed with.
 * @param root the repository root
 * @param argv the arguments after git
 * @param options the command deadline, cancellation, and input
 * @returns the standard output as printed
 */
export async function gitText(root: string, argv: string[], options: GitOptions = {}): Promise<string> {
    const result = await runGit(root, argv, options);
    if (result.code !== 0)
        throw new GspotError('selection', [
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        ]);
    return result.stdout;
}

/**
 * A Git command's output as its non-empty lines.
 * @param root the repository root
 * @param argv the arguments after git
 * @param options the command deadline, cancellation, and input
 * @returns the lines, in order
 */
export async function gitLines(root: string, argv: string[], options: GitOptions = {}): Promise<string[]> {
    const text = await gitText(root, argv, options);
    return text.split('\n').filter((line) => line !== '');
}

/**
 * The paths a NUL-separated Git listing names.
 * @param root the repository root
 * @param argv the arguments after git, which must include -z
 * @param options the command deadline, cancellation, and input
 * @returns the paths, in order
 */
export async function gitPaths(root: string, argv: string[], options: GitOptions = {}): Promise<string[]> {
    const text = await gitText(root, argv, options);
    return text.split('\0').filter((path) => path !== '');
}

/**
 * Whether the repository's history is cut by a shallow clone.
 * @param root the repository root
 * @param options the command deadline, cancellation, and input
 * @returns true for a shallow repository
 */
export async function isShallow(root: string, options: GitOptions = {}): Promise<boolean> {
    const answer = await gitText(root, ['rev-parse', '--is-shallow-repository'], options);
    return answer.trim() === 'true';
}
