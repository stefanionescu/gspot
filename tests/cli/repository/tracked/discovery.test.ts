import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { statSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { readPrefix } from '#cli/platform/source.ts';
import { readRepository } from '#cli/repository/read.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { getEntries } from '#cli/repository/revisions/objects.ts';
import { findRoot, isGitRepository } from '#cli/repository/root.ts';
import { trackedEntries, readIndexEntries } from '#cli/repository/tracked.ts';
import { REPLACED_PARENT_PATHS } from '#tests/config/cli/repository/tracked.ts';

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
    const unexcluded = await readRepository(root, [], [], []);
    expect(unexcluded.files.map((file) => file.path)).toStrictEqual(['local.ts']);
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
        expect(readPrefix(sandbox.path, 'large.txt', 6).toString('utf8')).toBe('prefix');
        expect(reads.mock.calls[0]?.[2]).toMatchObject({ length: 6 });
        expect(() => readPrefix(sandbox.path, 'missing.txt', 6)).toThrow('ENOENT');
    } finally {
        reads.mockRestore();
    }
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
    expect(() => trackedEntries(cwd)).toThrow(/Git ls-files failed/u);
});

test('repository file discovery > reports invalid Git metadata instead of treating the directory as non-Git', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.git/sentinel': 'incomplete metadata',
        'source.ts': 'export {};\n',
    });
    expect(() => trackedEntries(sandbox.path)).toThrow(/Git ls-files failed/u);
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
        expect(() => trackedEntries(sandbox.path)).toThrow(/git executable not found/u);
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

test.each(REPLACED_PARENT_PATHS)(
    'tracked discovery reports a replaced parent of %s and accepts its correction',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: 'source' });
        expect(processes.runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', path], { cwd: sandbox.path }).code).toBe(0);
        fs.rmSync(join(sandbox.path, 'src'), { recursive: true });
        writeFileSync(join(sandbox.path, 'src'), 'replacement');
        let error: unknown;
        try {
            trackedEntries(sandbox.path);
        } catch (error_) {
            error = error_;
        }
        expect(error).toMatchObject({
            code: 'ENOTDIR',
            message: `Git lists ${path}, but src is now a file.`,
        });
        expect(fs.readFileSync(join(sandbox.path, 'src'), 'utf8')).toBe('replacement');
        fs.unlinkSync(join(sandbox.path, 'src'));
        await createFileTree(sandbox.path, { [path]: 'restored' });
        expect(trackedEntries(sandbox.path).map((entry) => entry.path)).toStrictEqual([path]);
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
        expect(processes.runBlocking(['git', ...argv], { cwd: sandbox.path }).code).toBe(0);
    // Only the file system knows this bit, and Windows file systems keep none.
    fs.chmodSync(join(sandbox.path, 'local.sh'), 0o700);
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    using listing = spyOn(processes, 'runBlocking');
    try {
        expect(trackedEntries(sandbox.path).map(({ path, executable }) => ({ path, executable }))).toStrictEqual([
            { path: 'indexed.sh', executable: true },
            { path: 'local.sh', executable: false },
        ]);
        expect(
            listing.mock.calls.filter(([command]) => command.includes('ls-files') && command.includes('--stage')),
        ).toHaveLength(1);
    } finally {
        Object.defineProperty(process, 'platform', { value: platform });
    }
});

test('an unmerged index keeps the working file readable but refuses a staged revision', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'working content\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    const hash = gitOutput(sandbox.path, ['hash-object', '-w', 'source.txt']);
    const update = processes.runBlocking(['git', 'update-index', '--index-info'], {
        cwd: sandbox.path,
        stdin: [1, 2, 3].map((stage) => `100644 ${hash} ${String(stage)}\tsource.txt\n`).join(''),
    });
    expect(update.code, update.stderr).toBe(0);
    expect(readIndexEntries(sandbox.path).map(({ path, stage }) => ({ path, stage }))).toStrictEqual([
        { path: 'source.txt', stage: 1 },
        { path: 'source.txt', stage: 2 },
        { path: 'source.txt', stage: 3 },
    ]);
    expect(trackedEntries(sandbox.path)).toStrictEqual([
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
    const run = processes.runBlocking;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
            if (!command.includes('ls-files') || !command.includes('--stage')) return run(command, options);
            return { code: 128, missing: false, stdout: '', stderr: 'Index access denied.', duration: 1 };
        }),
    );
    const platform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
        expect(() => trackedEntries(sandbox.path)).toThrow('Index access denied.');
    } finally {
        Object.defineProperty(process, 'platform', { value: platform });
    }
});
