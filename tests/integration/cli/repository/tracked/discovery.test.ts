import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { statSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { failure, rejection } from '#tests/support/expectations.ts';
import { head, findRoot, trackedEntries, isGitRepository } from '#cli/repository/tracked.ts';

test('repository file discovery > excluded links are omitted before resolving external targets', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside.ts': 'private external bytes',
    });
    const root = join(sandbox.path, 'project');
    fs.symlinkSync('../outside.ts', join(root, 'excluded.ts'));
    expect(processes.runBlocking(['git', 'init', '-q'], { cwd: root }).code).toBe(0);
    const repository = await readRepository(root, [], [], ['excluded.ts']);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    expect(await rejection(readRepository(root, [], [], []))).toMatch(/Source link leaves the repository/u);
    expect(fs.readFileSync(join(sandbox.path, 'outside.ts'), 'utf8')).toBe('private external bytes');
});

test('repository file discovery > keeps tracked deletions out of readable entries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
    expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd: sandbox.path }).code).toBe(0);
    fs.rmSync(join(sandbox.path, 'source.ts'));
    expect(trackedEntries(sandbox.path)).toStrictEqual([]);
});

test('repository file discovery > classifies a dangling tracked symlink without reading its absent target', async () => {
    await using sandbox = await testdir();
    fs.symlinkSync('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
    expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
    expect(processes.runBlocking(['git', 'add', 'linked.ts'], { cwd: sandbox.path }).code).toBe(0);
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files).toHaveLength(1);
    expect(repository.files[0]?.tags).toContain('symlink');
    expect(repository.files[0]?.kind).toBe('source');
});

test('repository file discovery > reads only the requested prefix and reports absent required content', async () => {
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

test('repository file discovery > finds the nearest policy in a non-Git directory', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'kits = []\n',
        'nested/source.ts': 'export {};\n',
    });
    expect(findRoot(join(sandbox.path, 'nested'))).toBe(sandbox.path);
});

test('repository file discovery > keeps the requested directory when no Git root or policy exists', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(findRoot(sandbox.path)).toBe(sandbox.path);
    expect(isGitRepository(sandbox.path)).toBe(false);
});

test('repository file discovery > walks a non-Git directory while honoring its ignore file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': 'ignored.ts\n',
        'source.ts': 'export {};\n',
        'ignored.ts': 'export {};\n',
    });
    const entries = trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['.gitignore', 'source.ts']);
});

test('repository file discovery > reports a corrupt Git index instead of switching to a directory walk', async () => {
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
    const entries = trackedEntries(cwd);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
    writeFileSync(join(cwd, '.git', 'index'), 'corrupt index');
    expect(failure(() => trackedEntries(cwd))?.message).toMatch(/Git ls-files failed/u);
});

test('repository file discovery > reports invalid Git metadata instead of treating the directory as non-Git', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.git/sentinel': 'incomplete metadata',
        'source.ts': 'export {};\n',
    });
    expect(failure(() => trackedEntries(sandbox.path))?.message).toMatch(/Git ls-files failed/u);
    expect(() => findRoot(sandbox.path)).toThrow('Git root discovery failed');
    expect(() => isGitRepository(sandbox.path)).toThrow('Git work-tree discovery failed');
});

test('repository file discovery > reports a missing Git executable instead of returning a successful walk', async () => {
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
        expect(failure(() => trackedEntries(sandbox.path))?.message).toMatch(/git executable not found/u);
        expect(() => findRoot(sandbox.path)).toThrow('git executable not found');
        expect(() => isGitRepository(sandbox.path)).toThrow('git executable not found');
    } finally {
        missing.mockRestore();
    }
});

test('non-Git discovery applies nested ignore overrides without sharing them with sibling directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': '*.log\nblocked/\n',
        'source.ts': 'source',
        'root.log': 'ignored',
        'blocked/.gitignore': '!inside.ts\n',
        'blocked/inside.ts': 'ignored directory',
        'nested/.gitignore': '!keep.log\nlocal.ts\n',
        'nested/keep.log': 'retained',
        'nested/other.log': 'ignored',
        'nested/local.ts': 'ignored',
        'nested/deeper/keep.log': 'retained by inherited override',
        'sibling/keep.log': 'ignored by root',
        'sibling/local.ts': 'retained',
        '.gspot/state/private.txt': 'ownership metadata',
    });
    fs.symlinkSync('source.ts', join(sandbox.path, 'linked.ts'));
    expect(trackedEntries(sandbox.path).map((entry) => entry.path)).toStrictEqual([
        '.gitignore',
        'nested/.gitignore',
        'nested/deeper/keep.log',
        'nested/keep.log',
        'sibling/local.ts',
        'source.ts',
    ]);
});

test('tracked discovery reports a directory replaced by a file and accepts its correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'src/source.ts': 'source' });
    expect(processes.runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
    expect(processes.runBlocking(['git', 'add', 'src/source.ts'], { cwd: sandbox.path }).code).toBe(0);
    fs.rmSync(join(sandbox.path, 'src'), { recursive: true });
    writeFileSync(join(sandbox.path, 'src'), 'replacement');
    expect(() => trackedEntries(sandbox.path)).toThrow('ENOTDIR');
    expect(fs.readFileSync(join(sandbox.path, 'src'), 'utf8')).toBe('replacement');
    fs.unlinkSync(join(sandbox.path, 'src'));
    await createFileTree(sandbox.path, { 'src/source.ts': 'restored' });
    expect(trackedEntries(sandbox.path).map((entry) => entry.path)).toStrictEqual(['src/source.ts']);
});
