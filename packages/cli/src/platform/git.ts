// The Git commands gspot runs: configuration reads, the hooks folder, and the queries of the revision code.
import { resolve } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { GIT_TIMEOUT_MS } from '#cli/config/platform/git.ts';
import { run, runBinary, runBlocking } from '#cli/platform/spawn.ts';
import type { GitOptions, SpawnResult, SpawnOptions, BinarySpawnResult } from '#cli/types/platform/runtime.ts';

/**
 * Runs Git and waits for it, with the one Git deadline.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as the environment
 * @returns what Git printed and how it exited
 */
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
export function runGit(root: string, argv: string[], options: GitOptions = {}): Promise<SpawnResult> {
    return run(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, cwd: root });
}

/**
 * Runs Git with the one Git deadline and keeps its output as bytes, for paths and objects that need not be UTF-8.
 * @param root the working directory
 * @param argv the arguments after git
 * @param options the other spawn options, such as standard input and a cancellation that may be absent
 * @returns the bytes Git printed and how it exited
 */
export function runGitBinary(root: string, argv: string[], options: GitOptions = {}): Promise<BinarySpawnResult> {
    return runBinary(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, cwd: root });
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
