import * as fs from 'node:fs';
import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/run/session.ts';
import { statSync, writeFileSync } from 'node:fs';
import * as processes from '#cli/platform/spawn.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { readRepository } from '#cli/repository/tree.ts';
import { findRoot, head, isGitRepository, trackedEntries } from '#cli/repository/tracked.ts';

describe('repository file discovery', () => {
    test('keeps tracked deletions out of readable entries', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd: sandbox.path }).code).toBe(0);
        fs.rmSync(join(sandbox.path, 'source.ts'));
        expect(await trackedEntries(sandbox.path)).toEqual([]);
    });

    test.each(['lstatSync', 'statSync'] as const)(
        'reports a denied %s instead of dropping a path',
        async (operation) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
            fs.symlinkSync('source.ts', join(sandbox.path, 'linked.ts'), 'file');
            const listed = spyOn(processes, 'runBlocking').mockReturnValue({
                code: 0,
                stdout: 'linked.ts\0',
                stderr: '',
                missing: false,
                duration: 0,
            });
            const denied = Object.assign(new Error('Permission denied for linked.ts'), { code: 'EACCES' });
            const metadata = spyOn(fs, operation).mockImplementation(() => {
                throw denied;
            });
            try {
                await rejects(trackedEntries(sandbox.path), denied);
            } finally {
                metadata.mockRestore();
                listed.mockRestore();
            }
        },
    );

    test('classifies a dangling tracked symlink without reading its absent target', async () => {
        await using sandbox = await testdir();
        fs.symlinkSync('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
        expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'linked.ts'], { cwd: sandbox.path }).code).toBe(0);
        const repository = await readRepository(sandbox.path, [], [], []);
        expect(repository.files).toHaveLength(1);
        expect(repository.files[0]?.tags).toContain('symlink');
        expect(repository.files[0]?.nature).toBe('source');
    });

    test('reads only the requested prefix and reports absent required content', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'large.txt': 'prefix' + 'x'.repeat(1024 * 1024) });
        const reads = spyOn(fs, 'readSync');
        try {
            expect(head(sandbox.path, 'large.txt', 6)).toBe('prefix');
            expect(reads.mock.calls[0]?.[2]).toMatchObject({ length: 6 });
            expect(() => head(sandbox.path, 'missing.txt')).toThrow('ENOENT');
        } finally {
            reads.mockRestore();
        }
    });

    test('a failed content read reports the error and closes its descriptor', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        const opened = spyOn(fs, 'openSync');
        const reads = spyOn(fs, 'readSync').mockImplementationOnce(() => {
            throw new Error('Planted read failure.');
        });
        try {
            expect(() => head(sandbox.path, 'source.ts')).toThrow('Planted read failure');
            const descriptor = opened.mock.results[0];
            expect(descriptor?.type).toBe('return');
            if (descriptor?.type === 'return') expect(() => fs.fstatSync(descriptor.value)).toThrow('EBADF');
        } finally {
            opened.mockRestore();
            reads.mockRestore();
        }
    });

    test('finds the nearest policy in a non-Git directory', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\n',
            'nested/source.ts': 'export {};\n',
        });
        expect(findRoot(join(sandbox.path, 'nested'))).toBe(sandbox.path);
    });

    test('keeps the requested directory when no Git root or policy exists', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        expect(findRoot(sandbox.path)).toBe(sandbox.path);
        expect(isGitRepository(sandbox.path)).toBe(false);
    });

    test('walks a non-Git directory while honoring its ignore file', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': 'ignored.ts\n',
            'source.ts': 'export {};\n',
            'ignored.ts': 'export {};\n',
        });
        const entries = await trackedEntries(sandbox.path);
        expect(entries.map((entry) => entry.path)).toEqual(['.gitignore', 'source.ts']);
    });

    test('reports a corrupt Git index instead of switching to a directory walk', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        const cwd = sandbox.path;
        expect(processes.runBlocking(['git', 'init'], { cwd }).code).toBe(0);
        expect(isGitRepository(cwd)).toBe(true);
        expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd }).code).toBe(0);
        const expectedRoot = statSync(cwd, { bigint: true });
        const actualRoot = statSync(findRoot(cwd), { bigint: true });
        expect(expectedRoot.ino).toBeGreaterThan(0n);
        expect(actualRoot.dev).toBe(expectedRoot.dev);
        expect(actualRoot.ino).toBe(expectedRoot.ino);
        const entries = await trackedEntries(cwd);
        expect(entries.map((entry) => entry.path)).toEqual(['source.ts']);
        writeFileSync(join(cwd, '.git', 'index'), 'corrupt index');
        await rejects(trackedEntries(cwd), { message: /Git ls-files failed/u });
    });

    test('reports invalid Git metadata instead of treating the directory as non-Git', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.git/sentinel': 'incomplete metadata',
            'source.ts': 'export {};\n',
        });
        await rejects(trackedEntries(sandbox.path), { message: /Git ls-files failed/u });
        expect(() => findRoot(sandbox.path)).toThrow('Git root discovery failed');
        expect(() => isGitRepository(sandbox.path)).toThrow('Git work-tree discovery failed');
    });

    test('reports a missing Git executable instead of returning a successful walk', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        const missing = spyOn(processes, 'runBlocking').mockReturnValue({
            code: 127,
            stdout: '',
            stderr: 'git executable not found',
            missing: true,
            duration: 0,
        });
        try {
            await rejects(trackedEntries(sandbox.path), { message: /git executable not found/u });
            expect(() => findRoot(sandbox.path)).toThrow('git executable not found');
            expect(() => isGitRepository(sandbox.path)).toThrow('git executable not found');
        } finally {
            missing.mockRestore();
        }
    });
});

test('opening a session reads less than one megabyte with a fifty-megabyte source', async () => {
    const megabyte = 1024 * 1024;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = []\n',
        large: '#!/usr/bin/env bash\n# @generated\n' + 'x'.repeat(50 * megabyte),
    });
    const prefixReads = spyOn(fs, 'readSync');
    const fullReads = spyOn(fs, 'readFileSync');
    try {
        const session = await openSession(sandbox.path);
        const large = session.repository.files.find((file) => file.path === 'large')!;
        expect(large.size).toBeGreaterThanOrEqual(50 * megabyte);
        expect(large.prefix.byteLength).toBe(4096);
        expect(large.tags).toContain('bash');
        expect(large.nature).toBe('generated');
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
