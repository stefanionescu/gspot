import { join } from 'node:path';
import { statSync, chmodSync } from 'node:fs';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox planted.
 * @param cwd the planted repository
 * @param argv the command line after git
 * @param environment extra variables
 * @returns the exit code and both streams
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every test runs Git with a throwaway identity, no background maintenance, and planted line endings through this.
export function git(cwd: string, argv: string[], environment: Record<string, string> = {}): SpawnOutcome {
    const result = Bun.spawnSync(
        [
            'git',
            '-c',
            'user.email=t@t',
            '-c',
            'user.name=t',
            '-c',
            'maintenance.auto=false',
            '-c',
            'gc.auto=0',
            // Git for Windows converts checkouts to CRLF by default; a sandbox keeps the bytes it planted.
            '-c',
            'core.autocrlf=false',
            ...argv,
        ],
        {
            cwd,
            env: { ...environmentVariables(), ...environment },
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 30_000,
        },
    );
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/**
 * Runs git and returns what it printed, for a command a test needs the answer of.
 * @param cwd the planted repository
 * @param argv the command line after git
 * @returns the trimmed standard output
 */
export function gitOutput(cwd: string, argv: string[]): string {
    const result = git(cwd, argv);
    if (result.code !== 0) throw new Error(`Git ${argv.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
 * Makes the planted directory a git repository with one commit, the state init expects.
 * @param cwd the planted repository
 */
export function commitAll(cwd: string): void {
    for (const args of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', 'init'],
    ]) {
        const result = git(cwd, args);
        if (result.code !== 0) throw new Error(`Sandbox Git setup failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Marks a planted file executable where each platform keeps the bit: the file mode, and on Windows, whose file systems
 * keep none, the Git index.
 * @param cwd the planted repository
 * @param path the repository-relative file
 */
export function markExecutable(cwd: string, path: string): void {
    const full = join(cwd, path);
    chmodSync(full, statSync(full).mode | 0o111);
    if (process.platform !== 'win32') return;
    for (const argv of [
        ['add', '--', path],
        ['update-index', '--chmod=+x', '--', path],
    ]) {
        const result = git(cwd, argv);
        if (result.code !== 0) throw new Error(`Marking ${path} executable failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Returns the index entries of the paths to the last commit, undoing what marking them executable staged.
 * @param cwd the planted repository
 * @param paths the repository-relative files
 */
export function resetIndex(cwd: string, paths: string[]): void {
    if (process.platform !== 'win32' || paths.length === 0) return;
    const result = git(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}
