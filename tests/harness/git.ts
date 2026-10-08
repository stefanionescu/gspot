import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { stat, chmod, writeFile } from 'node:fs/promises';
import { PUSH_CONTENT } from '#tests/config/samples/git.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { PushRepository } from '#tests/types/harness/git.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';

/**
 * Runs git with a throwaway identity, keeping the line endings the sandbox specifies.
 * @param cwd the sandbox
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
        },
    );
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs git and returns what it printed, for a command a test needs the answer of.
 * @param cwd the sandbox
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
 * @param cwd the sandbox
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
 * Marks a test file executable where each platform keeps the bit: the file mode, and on Windows, whose file systems
 * keep none, the Git index.
 * @param cwd the sandbox
 * @param path the repository-relative file
 */
export async function markExecutable(cwd: string, path: string): Promise<void> {
    const full = join(cwd, path);
    const attributes = await stat(full);
    await chmod(full, attributes.mode | 0o111);
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
 * Creates committed source and conflicting working-tree bytes for native and command push selection.
 * @param root the sandbox
 * @returns the commit objects and the zero object for a new ref
 */
export async function preparePushRepository(root: string): Promise<PushRepository> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
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
    await writeFile(join(root, 'gspot.toml'), PUSH_CONTENT.policy);
    return { base, reviewed, broken, zero: '0'.repeat(base.length) };
}
