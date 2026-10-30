import { join } from 'node:path';
import { stat, chmod } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import { EXECUTABLE_BITS } from '#cli/config/repository/files.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';

/**
Run git and return its trimmed output; throw when git fails.
*/
export function runGitStep(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): string {
    const result = runCommandBlocking(['git', ...commandArguments], { cwd: cwd, env: environment });
    if (result.code !== 0)
        throw new Error(`Git ${commandArguments.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
Commit every file of the folder, create the repository first when the folder has none, and return the commit hash.
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
*/
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const absolute = join(cwd, path);
    const attributes = await stat(absolute);
    await chmod(absolute, attributes.mode | EXECUTABLE_BITS);
    if (!isWindows) return;
    runGitStep(cwd, ['add', '--', path]);
    runGitStep(cwd, ['update-index', '--chmod=+x', '--', path]);
}
