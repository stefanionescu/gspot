import { join } from 'node:path';
import { statSync, chmodSync } from 'node:fs';
import { GIT_TIMEOUT_MS } from '#tests/config/harness/git.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox specifies.
 * @param cwd the test repository
 * @param argv the command line after git
 * @param environment verbatim variables
 * @returns the exit code and both streams
 */

export function git(cwd: string, argv: string[], environment: Record<string, string> = {}): SpawnOutcome {
    const result = runTestCommandBlocking(
        [
            'git',
            '-c',
            'user.email=t@t',
            '-c',
            'user.name=t',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'maintenance.auto=false',
            '-c',
            'gc.auto=0',
            // Git for Windows converts checkouts to CRLF by default; a sandbox keeps the bytes it created.
            '-c',
            'core.autocrlf=false',
            ...argv,
        ],
        {
            cwd,
            env: { ...environmentVariables(), ...environment },
            timeoutMs: GIT_TIMEOUT_MS,
        },
    );
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs git and returns what it printed, for a command a test needs the answer of.
 * @param cwd the test repository
 * @param argv the command line after git
 * @returns the trimmed standard output
 */
export function gitOutput(cwd: string, argv: string[]): string {
    const result = git(cwd, argv);
    if (result.code !== 0) throw new Error(`Git ${argv.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
 * Makes the test directory a git repository with one commit, the state init expects.
 * @param cwd the test repository
 */
export function commitAll(cwd: string): void {
    for (const args of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', 'init'],
    ]) {
        const result = git(cwd, args);
        if (result.code !== 0) throw new Error(`Test repository Git setup failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Marks a test file executable where each platform keeps the bit: the file mode, and on Windows, whose file systems
 * keep none, the Git index.
 * @param cwd the test repository
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
