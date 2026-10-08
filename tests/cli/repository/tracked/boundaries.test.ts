import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, symlink } from 'node:fs/promises';
import * as processes from '#cli/platform/spawn.ts';
import { readPrefix } from '#cli/platform/source.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { trackedEntries } from '#cli/repository/tracked.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';

test('opening a session reads less than one megabyte with a two-megabyte source', async () => {
    const megabyte = 1024 * 1024;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        large: '#!/usr/bin/env bash\n# @generated\n' + 'x'.repeat(2 * megabyte),
    });
    const prefixReads = spyOn(fs, 'readSync');
    const fullReads = spyOn(fs, 'readFileSync');
    try {
        const session = await openSession(sandbox.path);
        const large = session.repository.files.find((file) => file.path === 'large')!;
        expect(large.size).toBeGreaterThanOrEqual(2 * megabyte);
        expect(large.prefix.byteLength).toBe(4096);
        expect(large.tags).toContain('bash');
        expect(large.kind).toBe('generated');
        const prefixBytes = prefixReads.mock.results.reduce(
            (sum, result) => sum + (result.type === 'return' ? result.value : 0),
            0,
        );
        const fullBytes = fullReads.mock.results.reduce(
            (sum, result) => sum + (result.type === 'return' ? Buffer.byteLength(result.value) : 0),
            0,
        );
        expect(prefixBytes).toBeLessThanOrEqual(4096 * session.repository.files.length);
        expect(prefixBytes + fullBytes).toBeLessThan(megabyte);
    } finally {
        prefixReads.mockRestore();
        fullReads.mockRestore();
    }
});

test.each([
    ['linked.ts', '../outside/secret.ts'],
    ['linked-directory', '../outside'],
])('source discovery leaves out the external %s link before inspection', async (name, target) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });
    const root = join(directory.path, 'project');
    gitOutput(root, ['init', '-q']);
    await symlink(target, join(root, name));
    gitOutput(root, ['add', '--', name]);
    const repository = await readRepository(root, [], [], []);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    expect(() => readPrefix(root, name, 64)).toThrow('Source link leaves the repository');
    await unlink(join(root, name));
    gitOutput(root, ['rm', '--cached', '--', name]);
    await symlink('local.ts', join(root, 'linked.ts'));
    gitOutput(root, ['add', 'linked.ts']);
    const corrected = await readRepository(root, [], [], []);
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toContain('symlink');
    expect(readPrefix(root, 'linked.ts', 64).toString('utf8')).toBe('export const local = true;\n');
});

test.skipIf(!isPosix)('a non-Git walk omits named pipes from readable source files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.runBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const entries = await trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
});
