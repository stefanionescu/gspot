// Creates test commits and reads Git output.
import { join } from 'node:path';
import { isWindows } from '#tests/setup/system.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { LFS_ATTRIBUTES } from '#tests/data/hooks.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import { stat, chmod, writeFile } from 'node:fs/promises';
import { EXECUTABLE_BITS } from '#cli/config/system/modes.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { NESTED_SCOPE_FILES } from '#tests/data/runs/copies.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { PUSH_CONTENT, HOOKS_SETTINGS, GIT_TEST_ARGUMENTS, GIT_TEST_ENVIRONMENT } from '#tests/data/test-setup.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox specifies.
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
    const result = runCommandBlocking(['git', ...GIT_TEST_ARGUMENTS, ...commandArguments], {
        cwd,
        env: { ...buildSpawnEnvironment(), ...GIT_TEST_ENVIRONMENT, ...environment },
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs git and returns what it printed; throws when git fails.
 *
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
    return readGitOutput(cwd, ['rev-parse', 'HEAD']);
}

/**
 * Marks a test file executable in the file mode and, on Windows, whose file systems keep no mode bits, in the Git
 * index.
 *
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
 *
 * @param sandboxRoot folder for the repository.
 * @returns the commit hashes and the zero hash for a new ref.
 */
export async function preparePushRepository(
    sandboxRoot: string,
): Promise<{ base: string; reviewed: string; broken: string; zero: string }> {
    await createFileTree(sandboxRoot, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': PUSH_CONTENT.base,
        'legacy.sh': PUSH_CONTENT.broken,
    });
    const base = commitAll(sandboxRoot);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.reviewed);
    const reviewed = commitAll(sandboxRoot, 'reviewed');
    readGitOutput(sandboxRoot, ['branch', 'reviewed', reviewed]);
    await writeFile(join(sandboxRoot, 'changed.sh'), PUSH_CONTENT.broken);
    const broken = commitAll(sandboxRoot, 'unreviewed');
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
    const base = commitAll(root, 'Fixture');
    await writeFile(join(project, 'source.txt'), 'pushed');
    await writeFile(join(root, 'outside.txt'), 'changed context');
    const commitId = commitAll(root, 'Change');
    await writeFile(join(project, 'source.txt'), 'indexed');
    readGitOutput(root, ['add', '.']);
    await writeFile(join(project, 'source.txt'), 'working');
    return { project, base, commitId };
}

/**
 * Create a Bash repository, apply, and commit the generated files for the fresh-clone tests.
 *
 * @param sourceRoot folder to initialize.
 */
export async function prepareAppliedBashRepository(sourceRoot: string): Promise<void> {
    await createFileTree(sourceRoot, {
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    readGitOutput(sourceRoot, ['init', '-q']);
    await runSandboxStep({ root: sourceRoot, environment: {}, run: runGspot }, ['apply']);
    commitAll(sourceRoot);
}

/**
 * Create a committed repository with hooks on and one file that Git Large File Storage (LFS) stores.
 *
 * @returns the sandbox, which removes itself on disposal.
 */
export async function createLfsRepository(): Promise<TestdirResult> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        '.gitattributes': LFS_ATTRIBUTES,
        'asset.bin': 'binary',
    });
    commitAll(sandbox.path);
    return sandbox;
}
