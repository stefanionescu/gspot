import * as cache from '#cli/execution/cache.ts';
import { readCached } from '#cli/execution/cache.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { storageSession } from '#tests/support/cli/storage.ts';
import { expect, spyOn, test } from 'bun:test';
import { throws } from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test.each(['{', '{"status":"ok","findings":[]}'])(
    'an edited cached result %s is preserved and the check runs again',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await storageSession(sandbox.path, 1);
        const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
        const initial = await executeRun(session, options);
        expect(initial.report.exitCode).toBe(1);
        const reportPath = join(sandbox.path, '.gspot/reports/report.json');
        const cache = join(sandbox.path, '.gspot/cache');
        const [entry] = fs.readdirSync(cache);
        fs.writeFileSync(join(cache, entry!), content);
        const stderr = spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const repeated = await executeRun(session, options);
            expect(repeated.report.exitCode).toBe(1);
            expect(repeated.report.checks[0]?.findings[0]?.message).toBe('Retained finding');
            expect(fs.readFileSync(join(cache, entry!), 'utf8')).toBe(content);
            expect(JSON.parse(fs.readFileSync(reportPath, 'utf8'))).toStrictEqual(repeated.report);
            expect(stderr.mock.calls.map((call) => String(call[0])).join('')).toContain(
                'Preserved edited or unowned cache',
            );
        } finally {
            stderr.mockRestore();
        }
    },
);

test('a denied owned cache read reports its path and cause', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
    });
    const session = await storageSession(sandbox.path, 0);
    const initial = await executeRun(session, { stage: 'commit', skips: [], fix: false, isDryRun: false });
    expect(initial.report.exitCode).toBe(0);
    const directory = join(sandbox.path, '.gspot/cache');
    const [entry] = fs.readdirSync(directory);
    if (entry === undefined) throw new Error('The executed check did not create its cache result.');
    const path = join(directory, entry);
    const mode = fs.statSync(path).mode & 0o777;
    fs.chmodSync(path, 0);
    try {
        throws(() => readCached(sandbox.path, entry.slice(0, -5)), /Could not read cached check result.*EACCES/u);
    } finally {
        fs.chmodSync(path, mode);
    }
});

test('checks share generated-file hashes within a run and observe edits in the next run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        '.gspot/shared.toml': 'value = 1\n',
        'source.ts': 'export {};\n',
    });
    const session = await storageSession(sandbox.path, 0);
    const manifest = session.scopes[0]!.selected[0]!;
    manifest.checks.push({ ...manifest.checks[0]!, name: 'sandbox/second' });
    const target = join(sandbox.path, '.gspot/shared.toml');
    const hash = cache.fileHash;
    let reads = 0;
    const observation = spyOn(cache, 'fileHash').mockImplementation((root, path) => {
        if (path === '.gspot/shared.toml') reads += 1;
        return hash(root, path);
    });
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
    try {
        const first = await executeRun(session, options);
        expect(first.report.checks.map((check) => check.status)).toStrictEqual(['ok', 'ok']);
        expect(reads).toBe(1);
        const unchanged = await executeRun(session, options);
        expect(unchanged.report.checks.map((check) => check.status)).toStrictEqual(['cache', 'cache']);
        fs.writeFileSync(target, 'value = 2\n');
        const changed = await executeRun(session, options);
        expect(changed.report.checks.map((check) => check.status)).toStrictEqual(['ok', 'ok']);
        expect(reads).toBe(3);
    } finally {
        observation.mockRestore();
    }
});

test('staged caches persist while index content, declared input additions, and corrections invalidate results', async () => {
    await using sandbox = await testdir();
    const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/content"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = (await Bun.file("source.txt").text()).startsWith("clean") ? 0 : 1'])}
paths = ["source.txt"]
inputs = ["source.txt", "inputs/**"]
stage = "commit"
[check.output]
format = "none"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'source.txt': 'clean baseline\n',
    });
    commitAll(sandbox.path);
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'clean staged\n');
    expect(git(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const command = ['check', '--staged', '--json'];
    const first = await run(sandbox.path, command);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(first.stdout)).checks[0]?.status).toBe('ok');
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'broken unstaged\n');
    const reused = await run(sandbox.path, command);
    expect(reused.code, reused.stdout + reused.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(reused.stdout)).checks[0]?.status).toBe('cache');
    expect(fs.readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('broken unstaged\n');
    expect(git(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(broken.stdout)).checks[0]?.status).toBe('fail');
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'clean staged\n');
    await createFileTree(sandbox.path, { 'inputs/added.txt': 'Declared input\n' });
    expect(git(sandbox.path, ['add', 'source.txt', 'inputs/added.txt']).code).toBe(0);
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks[0]?.status).toBe('ok');
    const unchanged = await run(sandbox.path, command);
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(unchanged.stdout)).checks[0]?.status).toBe('cache');
    expect(fs.readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});
