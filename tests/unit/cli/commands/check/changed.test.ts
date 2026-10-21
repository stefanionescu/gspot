import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildReportingCheck } from '#tests/setup/settings.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

async function prepareChangedRepository(root: string, files: Record<string, string>): Promise<void> {
    const gspotToml = stringify({
        configurations: [],
        command_check: [buildReportingCheck({ id: 'sandbox/paths', paths: ['api/**', 'web/**'], stage: 'commit' })],
    });

    await createFileTree(root, { 'gspot.toml': gspotToml, ...files });
}

test('--changed compares with the merge base, names its base, and a folder argument stays a path', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, {
        '.gitignore': '.gspot/\n',
        'api/source.txt': 'before',
        'web/source.txt': 'before',
    });
    readGitOutput(sandbox.path, ['init', '-b', 'main']);
    commitAll(sandbox.path);
    readGitOutput(sandbox.path, ['branch', 'base']);
    readGitOutput(sandbox.path, ['branch', '--set-upstream-to=base']);
    await writeFile(join(sandbox.path, 'api/source.txt'), 'committed change');
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'web/source.txt'), 'working change');
    const selected = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json', '--', 'api']),
    );
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    const report = selected.report;
    expect(report.comparison).toStrictEqual({ content: 'working-tree', reference: 'refs/heads/base' });
    expect(report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
    const explicit = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', 'base', '--json']),
    );
    expect(explicit.code, explicit.stdout + explicit.stderr).toBe(1);
    const all = explicit.report;
    expect(
        all.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
});

test('--changed without an upstream names the fix, and uses the remote default branch', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, { '.gitignore': '.gspot/\n', 'api/source.txt': 'before' });
    readGitOutput(sandbox.path, ['init', '-b', 'topic']);
    commitAll(sandbox.path);
    const absent = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json']);
    expect(absent.code).toBe(2);
    expect((JSON.parse(absent.stdout) as CommandFailureJson).message).toContain('use --changed <ref>');
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    readGitOutput(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    await writeFile(join(sandbox.path, 'api/source.txt'), 'changed');
    const defaultRange = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed']);
    expect(defaultRange.code, defaultRange.stdout + defaultRange.stderr).toBe(1);
    expect(defaultRange.stdout).toContain('refs/remotes/origin/main');
});

test('a shallow clone explains how to fetch the missing history', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    await prepareChangedRepository(source, { 'api/source.txt': 'before' });
    readGitOutput(source, ['init', '-b', 'main']);
    commitAll(source);
    const base = readGitOutput(source, ['rev-parse', 'HEAD']);
    await writeFile(join(source, 'api/source.txt'), 'after');
    commitAll(source);
    readGitOutput(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const result = await runGspot(join(sandbox.path, 'checkout'), [
        'check',
        '--only',
        'sandbox/paths',
        '--changed',
        base,
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toContain('git fetch --unshallow');
});
