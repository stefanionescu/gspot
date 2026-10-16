// Creates test commits and reads Git output.
import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { EXECUTABLE_BITS } from '#tests/config/files.ts';
import { stat, chmod, writeFile } from 'node:fs/promises';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { SpawnOutcome } from '#tests/types/processes.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/bash/tools.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { PUSH_CONTENT, GIT_TEST_CONFIG, GIT_TEST_ENVIRONMENT, SANDBOX_COMMIT_STEPS } from '#tests/config/git.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox specifies.
 * @param cwd the sandbox.
 * @param argv the command line after git.
 * @param environment verbatim variables.
 * @returns the exit code and both streams.
 */

export function git(cwd: string, argv: readonly string[], environment: Record<string, string> = {}): SpawnOutcome {
    const result = runCommandBlocking(['git', ...GIT_TEST_CONFIG, ...argv], {
        cwd,
        env: { ...buildSpawnEnvironment(), ...GIT_TEST_ENVIRONMENT, ...environment },
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs git and returns what it printed, for a command a test needs the answer of.
 * @param cwd the sandbox.
 * @param argv the command line after git.
 * @returns the trimmed standard output.
 */
export function gitOutput(cwd: string, argv: readonly string[]): string {
    const result = git(cwd, argv);
    if (result.code !== 0) throw new Error(`Git ${argv.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
 * Makes the test directory a git repository with one commit, the state init expects.
 * @param cwd the sandbox.
 */
export function commitAll(cwd: string): void {
    for (const args of SANDBOX_COMMIT_STEPS) {
        const result = git(cwd, args);
        if (result.code !== 0) throw new Error(`Sandbox Git setup failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Marks a test file executable where each platform keeps the bit: the file mode, and on Windows, whose file systems
 * keep none, the Git index.
 * @param cwd the sandbox.
 * @param path the repository-relative file.
 */
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const full = join(cwd, path);
    const attributes = await stat(full);
    await chmod(full, attributes.mode | EXECUTABLE_BITS);
    if (!isWindows) return;
    for (const argv of [
        ['add', '--', path],
        ['update-index', '--chmod=+x', '--', path],
    ]) {
        const result = git(cwd, argv);
        if (result.code !== 0) throw new Error(`Marking ${path} executable failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Creates committed source and conflicting working-tree bytes for built-in and command push selection.
 * @param root the sandbox.
 * @returns the commit objects and the zero object for a new ref.
 */
export async function preparePushRepository(
    root: string,
): Promise<{ base: string; reviewed: string; broken: string; zero: string }> {
    await createFileTree(root, {
        'gspot.toml': settingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': PUSH_CONTENT.base,
        'legacy.sh': PUSH_CONTENT.broken,
    });
    commitAll(root);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.reviewed);
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'reviewed']);
    const reviewed = gitOutput(root, ['rev-parse', 'HEAD']);
    gitOutput(root, ['branch', 'reviewed', reviewed]);
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.broken);
    gitOutput(root, ['add', 'changed.sh']);
    gitOutput(root, ['commit', '-qm', 'unreviewed']);
    const broken = gitOutput(root, ['rev-parse', 'HEAD']);
    await writeFile(join(root, 'changed.sh'), PUSH_CONTENT.working);
    await writeFile(join(root, 'gspot.toml'), PUSH_CONTENT.settings);
    return { base, reviewed, broken, zero: '0'.repeat(base.length) };
}
