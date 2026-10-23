// Run Git in test sandboxes, and prepare repositories with commits, pushes, nested scopes, and Git Large File Storage.
import { join } from 'node:path';
import { stat, chmod } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { EXECUTABLE_BITS } from '#cli/config/repository/files/tracked.ts';
import { GIT_CONFIG_ARGUMENTS, GIT_ISOLATION_ENVIRONMENT } from '#tests/config/setup/system/git.ts';

/**
 * Run git with a throwaway identity, keeping the line endings the sandbox specifies.
 *
 * @param cwd the sandbox.
 * @param commandArguments everything after git.
 * @param environment extra variables for git.
 * @returns the exit code and both streams.
 */
export function runGit(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): ProcessOutput {
    const result = runCommandBlocking(['git', ...GIT_CONFIG_ARGUMENTS, ...commandArguments], {
        cwd,
        env: { ...buildSpawnEnvironment(), ...GIT_ISOLATION_ENVIRONMENT, ...environment },
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Run git and returns what it printed; throws when git fails.
 *
 * @param cwd the sandbox.
 * @param commandArguments everything after git.
 * @returns the trimmed standard output.
 */
export function runGitStep(cwd: string, commandArguments: readonly string[]): string {
    const result = runGit(cwd, commandArguments);
    if (result.code !== 0)
        throw new Error(`Git ${commandArguments.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
 * Make the test folder a Git repository with one commit, the state init expects.
 *
 * @param cwd the sandbox.
 */
export function commitAll(cwd: string, message = 'init'): string {
    for (const commandArguments of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', message],
    ]) {
        const result = runGit(cwd, commandArguments);
        if (result.code !== 0) throw new Error(`Sandbox Git setup failed: ${result.stderr}${result.stdout}`);
    }
    return runGitStep(cwd, ['rev-parse', 'HEAD']);
}

/**
 * Make a test file executable: set its file mode, and on Windows, whose file systems keep no mode bits, set the mode in
 * the Git index too.
 *
 * @param cwd the sandbox.
 * @param path the repository-relative file.
 */
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const absolute = join(cwd, path);
    const attributes = await stat(absolute);
    await chmod(absolute, attributes.mode | EXECUTABLE_BITS);
    if (!isWindows) return;
    for (const commandArguments of [
        ['add', '--', path],
        ['update-index', '--chmod=+x', '--', path],
    ]) {
        const result = runGit(cwd, commandArguments);
        if (result.code !== 0) throw new Error(`Marking ${path} executable failed: ${result.stderr}${result.stdout}`);
    }
}
