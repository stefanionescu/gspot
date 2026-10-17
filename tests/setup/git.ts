// Creates test commits and reads Git output.
import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { isWindows } from '#tests/setup/system.ts';
import { stat, chmod, writeFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { NESTED_SCOPE_FILES } from '#tests/data/runs/scratch-copies.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';

import {
    PUSH_CONTENT,
    EXECUTABLE_BITS,
    GIT_TEST_ARGUMENTS,
    GIT_TEST_ENVIRONMENT,
    SANDBOX_COMMIT_STEPS,
} from '#tests/data/test-setup.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox specifies.
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
    const result = runCommandBlocking(['git', ...GIT_TEST_ARGUMENTS, ...commandArguments], {
        cwd,
        env: { ...buildSpawnEnvironment(), ...GIT_TEST_ENVIRONMENT, ...environment },
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs git and returns what it printed; throws when git fails.
 * @param cwd the sandbox.
 * @param commandArguments everything after git.
 * @returns the trimmed standard output.
 */
export function readGitOutput(cwd: string, commandArguments: readonly string[]): string {
    const result = runGit(cwd, commandArguments);
    if (result.code !== 0)
        throw new Error(`Git ${commandArguments.join(' ')} failed: ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

/**
 * Makes the test folder a Git repository with one commit, the state init expects.
 * @param cwd the sandbox.
 */
export function commitAll(cwd: string): void {
    for (const commandArguments of SANDBOX_COMMIT_STEPS) {
        const result = runGit(cwd, commandArguments);
        if (result.code !== 0) throw new Error(`Sandbox Git setup failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Marks a test file executable in the file mode and, on Windows, whose file systems keep no mode bits, in the Git
 * index.
 * @param cwd the sandbox.
 * @param path the repository-relative file.
 */
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const full = join(cwd, path);
    const attributes = await stat(full);
    await chmod(full, attributes.mode | EXECUTABLE_BITS);
    if (!isWindows) return;
    for (const commandArguments of [
        ['add', '--', path],
        ['update-index', '--chmod=+x', '--', path],
    ]) {
        const result = runGit(cwd, commandArguments);
        if (result.code !== 0) throw new Error(`Marking ${path} executable failed: ${result.stderr}${result.stdout}`);
    }
}

/**
 * Creates base, reviewed, and broken commits, plus different working-tree bytes, for the push tests.
 * @param sandboxRoot folder for the repository.
 * @returns the commit hashes and the zero hash for a new ref.
 */
export async function preparePushRepository(
    sandboxRoot: string,
): Promise<{ base: string; reviewed: string; broken: string; zero: string }> {
    await createFileTree(sandboxRoot, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': PUSH_CONTENT.base,
        'legacy.sh': PUSH_CONTENT.broken,
    });
    commitAll(sandboxRoot);
    const base = readGitOutput(sandboxRoot, ['rev-parse', 'HEAD']);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.reviewed);
    readGitOutput(sandboxRoot, ['add', 'changed.sh']);
    readGitOutput(sandboxRoot, ['commit', '-qm', 'reviewed']);
    const reviewed = readGitOutput(sandboxRoot, ['rev-parse', 'HEAD']);
    readGitOutput(sandboxRoot, ['branch', 'reviewed', reviewed]);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.broken);
    readGitOutput(sandboxRoot, ['add', 'changed.sh']);
    readGitOutput(sandboxRoot, ['commit', '-qm', 'unreviewed']);
    const broken = readGitOutput(sandboxRoot, ['rev-parse', 'HEAD']);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.working);
    await writeFile(join(sandboxRoot, 'gspot.toml'), PUSH_CONTENT.settings);
    return { base, reviewed, broken, zero: '0'.repeat(base.length) };
}

/** Create a repository with a nested scope whose source differs in the commit, the index, and the working tree. */
export async function prepareNestedRepository(
    root: string,
): Promise<{ project: string; base: string; commitId: string }> {
    await createFileTree(root, NESTED_SCOPE_FILES);
    const project = join(root, 'nested settings');
    readGitOutput(root, ['init']);
    readGitOutput(root, ['add', '.']);
    readGitOutput(root, ['commit', '-m', 'Fixture']);
    const base = readGitOutput(root, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'pushed');
    await Bun.write(join(root, 'outside.txt'), 'changed context');
    readGitOutput(root, ['add', '.']);
    readGitOutput(root, ['commit', '-m', 'Change']);
    const commitId = readGitOutput(root, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'indexed');
    readGitOutput(root, ['add', '.']);
    await Bun.write(join(project, 'source.txt'), 'working');
    return { project, base, commitId };
}

/**
 * Create a Bash repository, apply, and commit the generated files for the fresh-clone tests.
 * @param sourceRoot folder to initialize.
 */
export async function prepareAppliedBashRepository(sourceRoot: string): Promise<void> {
    await createFileTree(sourceRoot, {
        'gspot.toml': buildSettingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    readGitOutput(sourceRoot, ['init', '-q']);
    const applied = await runRegisteredCommand(sourceRoot, ['apply']);
    if (applied.exitCode !== 0) throw new Error(`Sandbox apply failed: ${applied.text}`);
    commitAll(sourceRoot);
}
