// Bun comparisons use Git history to distinguish committed and working-tree inputs.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';

const policy = `configurations = []
[check."sandbox/paths"]
command = ${JSON.stringify([process.execPath, '-e', 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;', '{files}'])}
paths = ["api/**", "web/**"]
stage = "commit"
[check."sandbox/paths".output]
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
    commitAll(sandbox.path);
    gitOutput(sandbox.path, ['branch', 'base']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=base']);
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'committed change');
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'web/source.txt'), 'working change');
    const selected = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', 'api', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.comparison).toStrictEqual({ content: 'working-tree', reference: 'refs/heads/base' });
    expect(report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
    const explicit = await runGspot(sandbox.path, [
        'check',
        '--only',
        'sandbox/paths',
        '--changed',
        '--base',
        'base',
        '--json',
    ]);
    expect(explicit.code, explicit.stdout + explicit.stderr).toBe(1);
    const all = JSON.parse(explicit.stdout) as RunReport;
    expect(
        all.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
    const invalid = await runGspot(sandbox.path, [
        'check',
        '--only',
        'sandbox/paths',
        '--changed',
        '--base',
        'missing-ref',
        '--json',
    ]);
    expect(invalid.code).toBe(2);
    expect((JSON.parse(invalid.stdout) as CommandFailureJson).message).toContain('Git merge-base failed');
});

test('changed selection resolves the remote default and refuses absent upstream objects', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
    });
    gitOutput(sandbox.path, ['init', '-b', 'topic']);
    commitAll(sandbox.path);
    const absent = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json']);
    expect(absent.code).toBe(2);
    expect((JSON.parse(absent.stdout) as CommandFailureJson).message).toContain('use --changed --base <ref>');
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    gitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'changed');
    const defaultRange = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed']);
    expect(defaultRange.code, defaultRange.stdout + defaultRange.stderr).toBe(1);
    expect(defaultRange.stdout).toContain('refs/remotes/origin/main');
    gitOutput(sandbox.path, ['branch', 'upstream']);
    gitOutput(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    gitOutput(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    const missing = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json']);
    expect(missing.code).toBe(2);
    expect((JSON.parse(missing.stdout) as CommandFailureJson).message).toContain('refs/heads/upstream');
});

test.each(['--changed', '--staged', '--hook'])('%s reports a setup error outside Git', async (flag) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.txt': 'before' });
    const result = await runGspot(sandbox.path, ['check', flag, ...(flag === '--hook' ? ['pre-push'] : []), '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toBe(
        '--staged, --changed, and pre-push checks need a Git repository.',
    );
    expect((JSON.parse(result.stdout) as CommandFailureJson).error).toBe('selection');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    expect(await Bun.file(join(sandbox.path, 'api/source.txt')).text()).toBe('before');
});

test('a shallow comparison failure explains how to fetch the missing history', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source/gspot.toml': policy, 'source/api/source.txt': 'before' });
    const source = join(sandbox.path, 'source');
    gitOutput(source, ['init', '-b', 'main']);
    commitAll(source);
    const base = gitOutput(source, ['rev-parse', 'HEAD']);
    await Bun.write(join(source, 'api/source.txt'), 'after');
    commitAll(source);
    gitOutput(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const result = await runGspot(join(sandbox.path, 'checkout'), [
        'check',
        '--only',
        'sandbox/paths',
        '--changed',
        '--base',
        base,
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toContain('git fetch --unshallow');
});
