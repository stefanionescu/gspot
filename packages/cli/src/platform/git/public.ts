import { resolve } from 'node:path';
import { GIT_TIMEOUT_MS } from '#cli/config/platform/git.ts';
import { run, runBinary, runStream, GspotError } from '#cli/platform/public.ts';
import { runGitBlocking, getGitEnvironment } from '#cli/platform/git/contracts.ts';
import type { GitOptions, SpawnResult, BinarySpawnResult } from '#cli/types/platform/runtime.ts';

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
 * Consume raw Git output under the shared rooted environment and process supervision.
 * @param root the working directory
 * @param argv arguments after git
 * @param read the consumer of uncaptured bytes
 * @param options deadline, cancellation, and standard input
 * @returns diagnostics and termination status
 */
export async function streamGit(
    root: string,
    argv: string[],
    read: (chunks: AsyncIterable<Buffer>) => Promise<void>,
    options: GitOptions = {},
): Promise<SpawnResult> {
    const selected = await getGitEnvironment(root, ['git', ...argv], options);
    if ('failure' in selected) return selected.failure;
    return runStream(['git', ...argv], { timeoutMs: GIT_TIMEOUT_MS, ...options, env: selected.env, cwd: root }, read);
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
