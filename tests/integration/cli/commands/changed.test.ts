import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/harness/cli/git.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Five commits in these journeys stage and commit the same way.
function commit(root: string): void {
    gitOutput(root, ['add', '.']);
    gitOutput(root, ['-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Update']);
}

const policy = `kits = []
[[check]]
name = "sandbox/paths"
command = ${JSON.stringify([process.execPath, '-e', 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;', '{files}'])}
paths = ["api/**", "web/**"]
stage = "commit"
[check.output]
format = "lines"
`;

test('changed selection uses a merge base, labels its source, and keeps a following folder positional', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
        'web/source.txt': 'before',
    });
    gitOutput(sandbox.path, ['init', '-b', 'main']);
    commit(sandbox.path);
    gitOutput(sandbox.path, ['branch', 'base']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=base']);
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'committed change');
    commit(sandbox.path);
    await Bun.write(join(sandbox.path, 'web/source.txt'), 'working change');
    const selected = await runGspot(sandbox.path, ['check', '--changed', 'api', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.comparison).toStrictEqual({ content: 'working-tree', reference: 'refs/heads/base' });
    expect(report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
    const explicit = await runGspot(sandbox.path, ['check', '--changed=base', '--json']);
    expect(explicit.code, explicit.stdout + explicit.stderr).toBe(1);
    const all = JSON.parse(explicit.stdout) as RunReport;
    expect(
        all.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
    const invalid = await runGspot(sandbox.path, ['check', '--changed=missing-ref', '--json']);
    expect(invalid.code).toBe(2);
    expect((JSON.parse(invalid.stdout) as { message: string }).message).toContain('Git merge-base failed');
});

test('changed selection resolves the remote default and refuses absent upstream objects', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
    });
    gitOutput(sandbox.path, ['init', '-b', 'topic']);
    commit(sandbox.path);
    const absent = await runGspot(sandbox.path, ['check', '--changed', '--json']);
    expect(absent.code).toBe(2);
    expect((JSON.parse(absent.stdout) as { message: string }).message).toContain('use --changed=<ref>');
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    gitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'changed');
    const defaultRange = await runGspot(sandbox.path, ['check', '--changed']);
    expect(defaultRange.code, defaultRange.stdout + defaultRange.stderr).toBe(1);
    expect(defaultRange.stdout).toContain('refs/remotes/origin/main');
    gitOutput(sandbox.path, ['branch', 'upstream']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    gitOutput(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    const missing = await runGspot(sandbox.path, ['check', '--changed', '--json']);
    expect(missing.code).toBe(2);
    expect((JSON.parse(missing.stdout) as { message: string }).message).toContain('refs/heads/upstream');
});

test.each(['--changed', '--staged'])('%s reports a setup error outside Git', async (flag) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.txt': 'before' });
    const result = await runGspot(sandbox.path, ['check', flag, '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as { message: string }).message).toContain('requires a Git repository');
});

test('a shallow comparison failure explains how to fetch the missing history', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source/gspot.toml': policy, 'source/api/source.txt': 'before' });
    const source = join(sandbox.path, 'source');
    gitOutput(source, ['init', '-b', 'main']);
    commit(source);
    const base = gitOutput(source, ['rev-parse', 'HEAD']);
    await Bun.write(join(source, 'api/source.txt'), 'after');
    commit(source);
    gitOutput(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const result = await runGspot(join(sandbox.path, 'checkout'), ['check', `--changed=${base}`, '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as { message: string }).message).toContain('git fetch --unshallow');
});
