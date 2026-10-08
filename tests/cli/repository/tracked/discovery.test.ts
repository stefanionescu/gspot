import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import * as childProcess from 'node:child_process';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readRepository } from '#cli/repository/read.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { getEntries } from '#cli/repository/revisions/objects.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { findRoot, isGitRepository } from '#cli/repository/root.ts';
import { trackedEntries, readIndexEntries } from '#cli/repository/tracked.ts';
import { REPLACED_PARENT_PATHS } from '#tests/config/cli/repository/tracked.ts';
import { rm, stat, chmod, unlink, symlink, readFile, writeFile } from 'node:fs/promises';

test('repository file discovery > excluded links are omitted before resolving external targets', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside.ts': 'private external bytes',
    });
    const root = join(sandbox.path, 'project');
    await symlink('../outside.ts', join(root, 'excluded.ts'));
    gitOutput(root, ['init', '-q']);
    const repository = await readRepository(root, [], [], ['excluded.ts']);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
    const unexcluded = await readRepository(root, [], [], []);
    expect(unexcluded.files.map((file) => file.path)).toStrictEqual(['local.ts']);
});

test('repository file discovery > keeps tracked deletions out of readable entries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'source.ts']);
    await rm(join(sandbox.path, 'source.ts'));
    expect(await trackedEntries(sandbox.path)).toStrictEqual([]);
});

test('repository file discovery > classifies a dangling tracked symlink without reading its absent target', async () => {
    await using sandbox = await testdir();
    await symlink('missing.ts', join(sandbox.path, 'linked.ts'), 'file');
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', 'linked.ts']);
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files).toHaveLength(1);
    expect(repository.files[0]?.tags).toContain('symlink');
    expect(repository.files[0]?.kind).toBe('source');
});

test('repository file discovery > finds the nearest policy in a non-Git directory', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = []\n',
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
    const entries = await trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['.gitignore', 'source.ts']);
});

test('repository file discovery > reports a corrupt Git index instead of switching to a directory walk', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    const cwd = sandbox.path;
    gitOutput(cwd, ['init']);
    expect(isGitRepository(cwd)).toBe(true);
    gitOutput(cwd, ['add', 'source.ts']);
    const expectedRoot = await stat(cwd, { bigint: true });
    const canonicalRoot = await stat(findRoot(cwd), { bigint: true });
    expect(expectedRoot.ino).toBeGreaterThan(0n);
    expect(canonicalRoot.dev).toBe(expectedRoot.dev);
    expect(canonicalRoot.ino).toBe(expectedRoot.ino);
    const entries = await trackedEntries(cwd);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
    await writeFile(join(cwd, '.git', 'index'), 'corrupt index');
    expect(await rejection(trackedEntries(cwd))).toContain('Git ls-files failed');
});

test('repository file discovery > reports invalid Git metadata instead of treating the directory as non-Git', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.git/sentinel': 'incomplete metadata',
        'source.ts': 'export {};\n',
    });
    expect(await rejection(trackedEntries(sandbox.path))).toContain('Git ls-files failed');
    expect(() => findRoot(sandbox.path)).toThrow('Git root discovery failed');
    expect(() => isGitRepository(sandbox.path)).toThrow('Git work-tree discovery failed');
});

test('repository file discovery > reports a missing Git executable instead of returning a successful walk', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    using resources = new DisposableStack();
    resources.use(
        spyOn(childProcess, 'spawnSync').mockReturnValue({
            pid: 0,
            output: [null, Buffer.alloc(0), Buffer.alloc(0)],
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
            status: null,
            signal: null,
            error: Object.assign(new Error('Cannot run Git: git executable not found'), { code: 'ENOENT' }),
        }),
    );
    resources.use(
        spyOn(processes, 'runBinary').mockResolvedValue({
            code: 127,
            stdout: Buffer.alloc(0),
            stderr: 'Cannot run Git: git executable not found',
            missing: true,
            duration: 0,
        }),
    );
    expect(await rejection(trackedEntries(sandbox.path))).toContain('git executable not found');
    expect(() => findRoot(sandbox.path)).toThrow('git executable not found');
    expect(() => isGitRepository(sandbox.path)).toThrow('git executable not found');
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
    await symlink('source.ts', join(sandbox.path, 'linked.ts'));
    const entries = await trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([
        '.gitignore',
        'nested/.gitignore',
        'nested/deeper/keep.log',
        'nested/keep.log',
        'sibling/local.ts',
        'source.ts',
    ]);
});

test.each(REPLACED_PARENT_PATHS)(
    'tracked discovery reports a replaced parent of %s and accepts its correction',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: 'source' });
        gitOutput(sandbox.path, ['init', '-q']);
        gitOutput(sandbox.path, ['add', path]);
        await rm(join(sandbox.path, 'src'), { recursive: true });
        await writeFile(join(sandbox.path, 'src'), 'replacement');
        expect(trackedEntries(sandbox.path)).rejects.toThrow(
            expect.objectContaining({ code: 'ENOTDIR', message: `Git lists ${path}, but src is now a file.` }),
        );
        expect(await readFile(join(sandbox.path, 'src'), 'utf8')).toBe('replacement');
        await unlink(join(sandbox.path, 'src'));
        await createFileTree(sandbox.path, { [path]: 'restored' });
        const entries = await trackedEntries(sandbox.path);
        expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
    },
);

test('on Windows, tracked discovery takes the executable bit from the Git index', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'indexed.sh': '#!/bin/sh\n', 'local.sh': '#!/bin/sh\n' });
    for (const argv of [
        ['init', '-q'],
        ['add', '-A'],
        ['update-index', '--chmod=+x', 'indexed.sh'],
    ])
        gitOutput(sandbox.path, argv);
    // Only the file system knows this bit, and Windows file systems keep none.
    await chmod(join(sandbox.path, 'local.sh'), 0o700);
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
        const entries = await trackedEntries(sandbox.path);
        expect(entries.map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
            { path: 'indexed.sh', executable: true },
            { path: 'local.sh', executable: false },
        ]);
    } finally {
        Object.defineProperty(process, 'platform', { value: platform });
    }
});

test('an unmerged index keeps the working file readable but refuses a staged revision', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'working content\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    const hash = gitOutput(sandbox.path, ['hash-object', '-w', 'source.txt']);
    const update = runTestCommandBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\tsource.txt\n`).join(''),
    });
    expect(update.code, update.stderr).toBe(0);
    const index = await readIndexEntries(sandbox.path);
    expect(index.map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    expect(await trackedEntries(sandbox.path)).toStrictEqual([
        { path: 'source.txt', size: Buffer.byteLength('working content\n'), executable: false, symlink: false },
    ]);
    expect(await rejection(getEntries(sandbox.path, { kind: 'index' }))).toContain('Resolve index conflicts');
});

test('a failed index listing cannot report a Windows executable as an ordinary file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.sh': '#!/bin/sh\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', 'source.sh']);
    gitOutput(sandbox.path, ['update-index', '--chmod=+x', 'source.sh']);
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'runBinary').mockResolvedValueOnce({
            code: 128,
            stdout: Buffer.alloc(0),
            stderr: 'Index access denied.',
            missing: false,
            duration: 0,
        }),
    );
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
        expect(await rejection(trackedEntries(sandbox.path))).toContain('Index access denied.');
    } finally {
        Object.defineProperty(process, 'platform', { value: platform });
    }
});
