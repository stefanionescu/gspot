import { join } from 'node:path';
import { stat, chmod } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { EXECUTABLE_BITS } from '#cli/config/repository/files/tracked.ts';
import { testdir, type DirectoryJSON, type TestdirResult } from 'testdirs';
import { GIT_CONFIG_ARGUMENTS, GIT_ISOLATION_ENVIRONMENT } from '#tests/config/setup/system/git.ts';

/**
Run git with a throwaway identity, keeping the line endings the sandbox specifies.

@param cwd the sandbox.
@param commandArguments everything after git.
@param environment extra variables for git.
@returns the exit code and both streams.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 31 calls in 11 files share it.
export function runGit(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): ProcessOutput {
    const result = runCommandBlocking(['git', ...GIT_CONFIG_ARGUMENTS, ...commandArguments], {
        cwd,
        env: { ...GIT_ISOLATION_ENVIRONMENT, ...environment },
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
Run git and return its trimmed output; throw when git fails.

@param cwd the sandbox.
@param commandArguments everything after git.
@returns the trimmed standard output.
*/
export function runGitStep(cwd: string, commandArguments: readonly string[]): string {
    const result = runGit(cwd, commandArguments);
    if (result.code !== 0)
        throw new Error(`Git ${commandArguments.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
Commit every file of the folder, and create the repository first when the folder has none.

@param cwd the sandbox.
@param message the subject that Git records for the commit.
@returns the hash of the new commit.
*/
export function commitAll(cwd: string, message = 'init'): string {
    runGitStep(cwd, ['init', '-q']);
    runGitStep(cwd, ['add', '-A']);
    runGitStep(cwd, ['commit', '-qm', message]);
    return runGitStep(cwd, ['rev-parse', 'HEAD']);
}

/**
Make a test file executable: set its file mode, and on Windows, whose file systems keep no mode bits, set the mode in
the Git index too.

@param cwd the sandbox.
@param path the repository-relative file.
*/
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const absolute = join(cwd, path);
    const attributes = await stat(absolute);
    await chmod(absolute, attributes.mode | EXECUTABLE_BITS);
    if (!isWindows) return;
    runGitStep(cwd, ['add', '--', path]);
    runGitStep(cwd, ['update-index', '--chmod=+x', '--', path]);
}

/**
Create a sandbox from these files and make it a Git repository without commits.

@param files the paths and text to write.
@returns the sandbox, which removes itself when disposed.
*/
export async function createGitSandbox(files: DirectoryJSON): Promise<TestdirResult> {
    const sandbox = await testdir(files);
    runGitStep(sandbox.path, ['init', '--quiet']);
    return sandbox;
}
