import * as fs from 'node:fs';
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { rejects } from 'node:assert/strict';
import { statSync, writeFileSync } from 'node:fs';
import * as processes from '#cli/platform/spawn.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { readRepository } from '#cli/repository/tree.ts';
import { findRoot, head, trackedEntries } from '#cli/repository/tracked.ts';

describe('repository file discovery', () => {
    test('keeps tracked deletions out of readable entries', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        expect(processes.runBlocking(['git', 'init'], { cwd: fixture.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd: fixture.path }).code).toBe(0);
        fs.rmSync(join(fixture.path, 'source.ts'));
        expect(await trackedEntries(fixture.path)).toEqual([]);
    });

    test.each(['lstatSync', 'statSync'] as const)(
        'reports a denied %s instead of dropping a path',
        async (operation) => {
            await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
            fs.symlinkSync('source.ts', join(fixture.path, 'linked.ts'), 'file');
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
                await rejects(trackedEntries(fixture.path), denied);
            } finally {
                metadata.mockRestore();
                listed.mockRestore();
            }
        },
    );

    test('classifies a dangling tracked symlink without reading its absent target', async () => {
        await using fixture = await createFixture({});
        fs.symlinkSync('missing.ts', join(fixture.path, 'linked.ts'), 'file');
        expect(processes.runBlocking(['git', 'init'], { cwd: fixture.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'linked.ts'], { cwd: fixture.path }).code).toBe(0);
        const repository = await readRepository(fixture.path, [], []);
        expect(repository.files).toHaveLength(1);
        expect(repository.files[0]?.tags).toContain('symlink');
        expect(repository.files[0]?.nature).toBe('source');
    });

    test('reads only the requested prefix and reports absent required content', async () => {
        await using fixture = await createFixture({ 'large.txt': 'prefix' + 'x'.repeat(1024 * 1024) });
        const reads = spyOn(fs, 'readSync');
        try {
            expect(head(fixture.path, 'large.txt', 6)).toBe('prefix');
            expect(reads.mock.calls[0]?.[2]).toMatchObject({ length: 6 });
            expect(() => head(fixture.path, 'missing.txt')).toThrow('ENOENT');
        } finally {
            reads.mockRestore();
        }
    });

    test('a failed content read reports the error and closes its descriptor', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        const opened = spyOn(fs, 'openSync');
        const reads = spyOn(fs, 'readSync').mockImplementationOnce(() => {
            throw new Error('Planted read failure.');
        });
        try {
            expect(() => head(fixture.path, 'source.ts')).toThrow('Planted read failure');
            const descriptor = opened.mock.results[0];
            expect(descriptor?.type).toBe('return');
            if (descriptor?.type === 'return') expect(() => fs.fstatSync(descriptor.value)).toThrow('EBADF');
        } finally {
            opened.mockRestore();
            reads.mockRestore();
        }
    });

    test('finds the nearest policy in a non-Git directory', async () => {
        await using fixture = await createFixture({
            'gspot.toml': 'version = 1\n',
            'nested/source.ts': 'export {};\n',
        });
        expect(findRoot(join(fixture.path, 'nested'))).toBe(fixture.path);
    });

    test('keeps the requested directory when no Git root or policy exists', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        expect(findRoot(fixture.path)).toBe(fixture.path);
    });

    test('walks a non-Git directory while honoring its ignore file', async () => {
        await using fixture = await createFixture({
            '.gitignore': 'ignored.ts\n',
            'source.ts': 'export {};\n',
            'ignored.ts': 'export {};\n',
        });
        const entries = await trackedEntries(fixture.path);
        expect(entries.map((entry) => entry.path)).toEqual(['.gitignore', 'source.ts']);
    });

    test('reports a corrupt Git index instead of switching to a directory walk', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        const cwd = fixture.path;
        expect(processes.runBlocking(['git', 'init'], { cwd }).code).toBe(0);
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
        await using fixture = await createFixture({
            '.git/sentinel': 'incomplete metadata',
            'source.ts': 'export {};\n',
        });
        await rejects(trackedEntries(fixture.path), { message: /Git ls-files failed/u });
        expect(() => findRoot(fixture.path)).toThrow('Git root discovery failed');
    });

    test('reports a missing Git executable instead of returning a successful walk', async () => {
        await using fixture = await createFixture({ 'source.ts': 'export {};\n' });
        const missing = spyOn(processes, 'runBlocking').mockReturnValue({
            code: 127,
            stdout: '',
            stderr: 'git executable not found',
            missing: true,
            duration: 0,
        });
        try {
            await rejects(trackedEntries(fixture.path), { message: /git executable not found/u });
            expect(() => findRoot(fixture.path)).toThrow('git executable not found');
        } finally {
            missing.mockRestore();
        }
    });
});
