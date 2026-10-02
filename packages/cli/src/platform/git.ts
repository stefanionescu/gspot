// The Git commands gspot runs: configuration reads, the hooks folder, and the queries of the revision code.
import { resolve } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { GIT_TIMEOUT_MS } from '#cli/config/platform/platform.ts';
import { run, runBinary, runBlocking } from '#cli/platform/spawn.ts';
import type { GitOptions, SpawnResult, SpawnOptions, BinarySpawnResult } from '#cli/types/platform/platform.ts';

/**
 * Runs Git and waits for it, with the one Git deadline.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as the environment
 * @returns what Git printed and how it exited
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every Git command runs through these three, so each gets the one deadline.
export function runGitBlocking(root: string, argv: string[], options: Omit<SpawnOptions, 'cwd'> = {}): SpawnResult {
    return runBlocking(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, cwd: root });
}

/**
 * Runs Git with the one Git deadline.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as standard input and a cancellation that may be absent
 * @returns what Git printed and how it exited
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every Git command runs through these three, so each gets the one deadline.
export function runGit(root: string, argv: string[], options: GitOptions = {}): Promise<SpawnResult> {
    const { cancelSignal, ...rest } = options;
    return run(['git', ...argv], {
        timeoutMs: GIT_TIMEOUT_MS,
        ...rest,
        cwd: root,
        ...(cancelSignal && { cancelSignal }),
    });
}

/**
 * Runs Git with the one Git deadline and keeps its output as bytes, for paths and objects that need not be UTF-8.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as standard input and a cancellation that may be absent
 * @returns the bytes Git printed and how it exited
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every Git command runs through these three, so each gets the one deadline.
export function runGitBinary(root: string, argv: string[], options: GitOptions = {}): Promise<BinarySpawnResult> {
    const { cancelSignal, ...rest } = options;
    return runBinary(['git', ...argv], {
        timeoutMs: GIT_TIMEOUT_MS,
        ...rest,
        cwd: root,
        ...(cancelSignal && { cancelSignal }),
    });
}

/**
 * Reads a Git configuration value, distinguishing an unset key from a failed command.
 * @param root the working directory
 * @param key the configuration key
 * @returns the exact value, or undefined when the key is unset
 */
export function readGitSetting(root: string, key: string): string | undefined {
    const result = runBlocking(['git', 'config', '--null', '--get', key], { cwd: root });
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
    const result = runBlocking(['git', 'rev-parse', '--git-path', 'hooks'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve the Git hooks folder: ${result.stderr.trim()}`);
    return resolve(root, result.stdout.replace(/\n$/u, ''));
}

/**
 * What a Git command prints, or the selection error it failed with.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the standard output as printed
 */
export async function gitText(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string> {
    const result = await run(['git', ...argv], {
        cwd: root,
        timeoutMs: GIT_TIMEOUT_MS,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (result.code !== 0)
        throw new GspotError('selection', [
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        ]);
    return result.stdout;
}

/**
 * A Git command's output as one value: the text with surrounding whitespace removed.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the trimmed output
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Git queries that return one value trim the output the same way.
export async function gitValue(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string> {
    const text = await gitText(root, argv, cancelSignal);
    return text.trim();
}

/**
 * A Git command's output as its non-empty lines.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the lines, in order
 */
export async function gitLines(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    const text = await gitText(root, argv, cancelSignal);
    return text.split('\n').filter((line) => line !== '');
}

/**
 * The paths a NUL-separated Git listing names.
 * @param root the repository root
 * @param argv the arguments after git, which must include -z
 * @param cancelSignal cancellation for the command
 * @returns the paths, in order
 */
export async function gitPaths(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    const text = await gitText(root, argv, cancelSignal);
    return text.split('\0').filter((path) => path !== '');
}

/**
 * Whether the repository's history is cut by a shallow clone.
 * @param root the repository root
 * @param cancelSignal cancellation for the command
 * @returns true for a shallow repository
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Push selection and its refusal both ask Git whether the history is cut.
export async function isShallow(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const answer = await gitValue(root, ['rev-parse', '--is-shallow-repository'], cancelSignal);
    return answer === 'true';
}
