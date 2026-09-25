import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { cacheInputs, cacheKey, fileHash, pruneCache, writeCached } from '#cli/execution/cache.ts';
import { chmodSync, existsSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';

test('cache pruning removes only expired unchanged owned results', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = []\n' });
    const paths = ['1', '2', '3', '4'].map((digit) => `.gspot/cache/${digit.repeat(64)}.json`);
    const [expired, recent, edited, authored] = paths as [string, string, string, string];
    for (const path of [expired, recent, edited]) {
        writeCached(sandbox.path, path.slice('.gspot/cache/'.length, -'.json'.length), {
            check: 'project/example',
            scope: '',
            status: 'ok',
            files: 1,
            duration: 1,
            findings: [],
        });
    }
    writeFileSync(join(sandbox.path, edited), 'authored edit\n');
    writeFileSync(join(sandbox.path, authored), 'unowned\n');
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    for (const path of [expired, edited, authored]) utimesSync(join(sandbox.path, path), old, old);
    pruneCache(sandbox.path);
    expect(existsSync(join(sandbox.path, expired))).toBe(false);
    expect(existsSync(join(sandbox.path, recent))).toBe(true);
    expect(readFileSync(join(sandbox.path, edited), 'utf8')).toBe('authored edit\n');
    expect(readFileSync(join(sandbox.path, authored), 'utf8')).toBe('unowned\n');
    expect(readOwnership(sandbox.path).files.map((entry) => entry.path)).not.toContain(expired);
    expect(readOwnership(sandbox.path).pending).toBeUndefined();
});

test('file cache hashes distinguish binary bytes that decode to the same replacement text', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'bytes');
    writeFileSync(path, Buffer.from([0xff]));
    const first = fileHash(sandbox.path, 'bytes');
    writeFileSync(path, Buffer.from([0xfe]));
    expect(fileHash(sandbox.path, 'bytes')).not.toBe(first);
});

test('cache keys cannot confuse a newline in a filename with another input record', () => {
    const base = { check: 'project/example', scope: '', toolVersion: '1', configurationHash: 'policy' };
    const first = { path: 'a', hash: '1'.repeat(64) };
    const second = { path: 'b', hash: '2'.repeat(64) };
    expect(cacheKey({ ...base, files: [first, second] })).not.toBe(
        cacheKey({
            ...base,
            files: [{ path: `a:${first.hash}\nb`, hash: second.hash }],
        }),
    );
});

test('full cache-enabled runs retire old results while narrowed runs retain them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = []\n' });
    const key = 'a'.repeat(64);
    const path = join(sandbox.path, '.gspot/cache', `${key}.json`);
    writeCached(sandbox.path, key, {
        check: 'project/old',
        scope: '',
        status: 'ok',
        files: 0,
        duration: 0,
        findings: [],
    });
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(path, old, old);
    const session = await openSession(sandbox.path);
    const options = { stage: 'all' as const, skips: [], fix: false, isDryRun: false };
    await executeRun(session, { ...options, paths: [] });
    expect(existsSync(path)).toBe(true);
    await executeRun(session, { ...options, noCache: true });
    expect(existsSync(path)).toBe(true);
    await executeRun(session, options);
    expect(existsSync(path)).toBe(false);
});

test.each(['file', 'directory'] as const)('cache inputs refuse an external %s link', async (kind) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, { 'state/.keep': '' });
    await createFileTree(outside.path, { 'input.txt': 'external bytes' });
    symlinkSync(kind === 'file' ? join(outside.path, 'input.txt') : outside.path, join(sandbox.path, 'state/link'));
    expect(() => cacheInputs(sandbox.path, ['state/**'])).toThrow();
    expect(readFileSync(join(outside.path, 'input.txt'), 'utf8')).toBe('external bytes');
});

test('cache inputs refuse traversal hidden in a glob alternative', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'state/input.txt': 'input' });
    expect(() => cacheInputs(sandbox.path, ['{state,..}/**/*.txt'])).toThrow();
});

test('a check hashes its named configuration even when ignored and retains unrelated cached results', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
        '.gitignore': '.gspot/\n',
        'source.sh': '#!/bin/sh\necho example\n',
        '.gspot/config/ruff.toml': 'line-length = 88\n',
        '.gspot/config/shellcheckrc': 'valid',
        '.gspot/node_modules/.bin/shellcheck': `#!${process.execPath}
if (process.argv.includes('--version')) console.log('0.11.0');
else if ((await Bun.file(process.argv[process.argv.indexOf('--rcfile') + 1]).text()) === 'invalid') {
    console.log('source.sh:2:1: warning: planted configuration finding [SC9999]');
    process.exitCode = 1;
}
`,
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/.bin/shellcheck'), 0o755);
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], only: ['bash/shellcheck'], fix: false, isDryRun: false };
    expect((await executeRun(session, options)).report.checks[0]!.status).toBe('ok');
    expect((await executeRun(session, options)).report.checks[0]!.status).toBe('cache');
    writeFileSync(join(sandbox.path, '.gspot/config/ruff.toml'), 'line-length = 100\n');
    expect((await executeRun(session, options)).report.checks[0]!.status).toBe('cache');
    writeFileSync(join(sandbox.path, '.gspot/config/shellcheckrc'), 'invalid');
    const changed = await executeRun(session, options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.findings[0]!.message).toContain('planted configuration finding');
    writeFileSync(join(sandbox.path, '.gspot/config/shellcheckrc'), 'valid');
    expect((await executeRun(session, options)).report.exitCode).toBe(0);
});
