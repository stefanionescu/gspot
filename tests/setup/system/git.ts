import { chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { EXECUTABLE_BITS } from '#cli/config/system.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

export function runGitStep(
    cwd: string,
    commandArguments: readonly string[],
    environment: Record<string, string> = {},
): string {
    const result = runBlockingCommand(['git', ...commandArguments], { cwd: cwd, env: environment });
    if (result.code !== 0)
        throw new Error(`Git ${commandArguments.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

export function commitAll(cwd: string, message = 'init'): string {
    runGitStep(cwd, ['init', '-q']);
    runGitStep(cwd, ['add', '-A']);
    runGitStep(cwd, ['commit', '-qm', message]);
    return runGitStep(cwd, ['rev-parse', 'HEAD']);
}

/**
Put a file into the index at stages 1, 2, and 3, the way an unresolved merge leaves it.
*/
export function stageUnmergedFile(cwd: string, path: string): void {
    const hash = runGitStep(cwd, ['hash-object', '-w', path]);
    const stdin = [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\t${path}\n`).join('');
    const result = runBlockingCommand(['git', 'update-index', '--index-info'], { cwd, stdin });
    if (result.code !== 0) throw new Error(`Git update-index --index-info failed: ${result.stderr}`);
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
