import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { createSandbox } from '@gspot/testing';
import { run } from '#tests/harness/planted.ts';
import type { RunReport } from '#types/report.ts';
import { runBlocking } from '#cli/platform/spawn.ts';

function git(root: string, ...argv: string[]): string {
    const result = runBlocking(['git', ...argv], { cwd: root });
    expect(result.code, result.stderr).toBe(0);
    return result.stdout.trim();
}

function commit(root: string): void {
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Update');
}

const policy = `version = 1
presets = []
[[check]]
name = "sandbox/paths"
command = ${JSON.stringify([process.execPath, '-e', 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;', '{files}'])}
paths = ["api/**", "web/**"]
stage = "commit"
[check.output]
format = "lines"
`;

test('changed selection uses a merge base, labels its source, and keeps a following folder positional', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
        'web/source.txt': 'before',
    });
    git(sandbox.path, 'init', '-b', 'main');
    commit(sandbox.path);
    git(sandbox.path, 'branch', 'base');
    git(sandbox.path, 'branch', '--set-upstream-to=base');
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'committed change');
    commit(sandbox.path);
    await Bun.write(join(sandbox.path, 'web/source.txt'), 'working change');
    const selected = await run(sandbox.path, ['check', '--changed', 'api', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = JSON.parse(selected.stdout) as RunReport;
    expect(report.comparison).toEqual({ content: 'working-tree', reference: 'refs/heads/base' });
    expect(report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toEqual([
        'api/source.txt',
    ]);
    const explicit = await run(sandbox.path, ['check', '--changed=base', '--json']);
    expect(explicit.code, explicit.stdout + explicit.stderr).toBe(1);
    const all = JSON.parse(explicit.stdout) as RunReport;
    expect(
        all.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['api/source.txt', 'web/source.txt']);
    const saved = (await Bun.file(join(sandbox.path, '.gspot/report.json')).json()) as RunReport;
    expect(saved.comparison).toEqual(all.comparison);
    const invalid = await run(sandbox.path, ['check', '--changed=missing-ref', '--json']);
    expect(invalid.code).toBe(2);
    expect((JSON.parse(invalid.stdout) as { message: string }).message).toContain('Git merge-base failed');
});

test('changed selection resolves the remote default and refuses absent upstream objects', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
    });
    git(sandbox.path, 'init', '-b', 'topic');
    commit(sandbox.path);
    const absent = await run(sandbox.path, ['check', '--changed', '--json']);
    expect(absent.code).toBe(2);
    expect((JSON.parse(absent.stdout) as { message: string }).message).toContain('use --changed=<ref>');
    git(sandbox.path, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(sandbox.path, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    await Bun.write(join(sandbox.path, 'api/source.txt'), 'changed');
    const fallback = await run(sandbox.path, ['check', '--changed']);
    expect(fallback.code, fallback.stdout + fallback.stderr).toBe(1);
    expect(fallback.stdout).toContain('refs/remotes/origin/main');
    git(sandbox.path, 'branch', 'upstream');
    git(sandbox.path, 'branch', '--set-upstream-to=upstream');
    git(sandbox.path, 'update-ref', '-d', 'refs/heads/upstream');
    const missing = await run(sandbox.path, ['check', '--changed', '--json']);
    expect(missing.code).toBe(2);
    expect((JSON.parse(missing.stdout) as { message: string }).message).toContain('refs/heads/upstream');
});

test.each(['--changed', '--staged'])('%s reports a setup error outside Git', async (flag) => {
    await using sandbox = await createSandbox({ 'gspot.toml': policy, 'api/source.txt': 'before' });
    const result = await run(sandbox.path, ['check', flag, '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as { message: string }).message).toContain('requires a Git repository');
});

test('a shallow comparison failure explains how to fetch the missing history', async () => {
    await using sandbox = await createSandbox({ 'source/gspot.toml': policy, 'source/api/source.txt': 'before' });
    const source = join(sandbox.path, 'source');
    git(source, 'init', '-b', 'main');
    commit(source);
    const base = git(source, 'rev-parse', 'HEAD');
    await Bun.write(join(source, 'api/source.txt'), 'after');
    commit(source);
    git(sandbox.path, 'clone', '--depth=1', pathToFileURL(source).href, 'checkout');
    const result = await run(join(sandbox.path, 'checkout'), ['check', `--changed=${base}`, '--json']);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as { message: string }).message).toContain('git fetch --unshallow');
});
