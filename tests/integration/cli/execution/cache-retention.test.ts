import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { cacheKey, fileHash, pruneCache, cacheInputs, writeCached } from '#cli/execution/cache.ts';
import { chmodSync, existsSync, utimesSync, readdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const DAY = 24 * 60 * 60 * 1000;

test('cache pruning deletes every cache file written more than a week ago and records nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
    const [expired, recent] = ['1', '2'].map((digit) => digit.repeat(64));
    for (const key of [expired!, recent!]) {
        writeCached(sandbox.path, key, {
            check: 'project/example',
            scope: '',
            status: 'ok',
            files: 1,
            duration: 1,
            findings: [],
        });
    }
    const stray = join(sandbox.path, '.gspot/cache/stray.yml');
    writeFileSync(stray, 'left by an older run\n');
    const eightDaysAgo = new Date(Date.now() - 8 * DAY);
    const sixDaysAgo = new Date(Date.now() - 6 * DAY);
    utimesSync(join(sandbox.path, `.gspot/cache/${expired!}.json`), eightDaysAgo, eightDaysAgo);
    utimesSync(stray, eightDaysAgo, eightDaysAgo);
    utimesSync(join(sandbox.path, `.gspot/cache/${recent!}.json`), sixDaysAgo, sixDaysAgo);
    pruneCache(sandbox.path);
    expect(readdirSync(join(sandbox.path, '.gspot/cache'))).toStrictEqual([`${recent!}.json`]);
    expect(existsSync(join(sandbox.path, '.gspot/state'))).toBe(false);
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

test('every real run prunes the cache, and a dry run or a run without the cache leaves it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
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
    const expiredAt = new Date(Date.now() - 8 * DAY);
    utimesSync(path, expiredAt, expiredAt);
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
    await executeRun(session, { ...options, noCache: true });
    expect(existsSync(path)).toBe(true);
    await executeRun(session, { ...options, isDryRun: true });
    expect(existsSync(path)).toBe(true);
    await executeRun(session, { ...options, paths: [] });
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

test('a check hashes its named kit even when ignored and retains unrelated cached results', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash'], '', 'all'),
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
    const executed = await executeRun(session, options);
    expect(executed.report.checks[0]!.status).toBe('ok');
    const repeated = await executeRun(session, options);
    expect(repeated.report.checks[0]!.status).toBe('cache');
    writeFileSync(join(sandbox.path, '.gspot/config/ruff.toml'), 'line-length = 100\n');
    const unrelated = await executeRun(session, options);
    expect(unrelated.report.checks[0]!.status).toBe('cache');
    writeFileSync(join(sandbox.path, '.gspot/config/shellcheckrc'), 'invalid');
    const changed = await executeRun(session, options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.findings[0]!.message).toContain('planted configuration finding');
    writeFileSync(join(sandbox.path, '.gspot/config/shellcheckrc'), 'valid');
    const restored = await executeRun(session, options);
    expect(restored.report.exitCode).toBe(0);
});
