import * as fs from 'node:fs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { trackedEntries } from '#cli/repository/tracked.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { readPrefix, readSource } from '#cli/platform/source.ts';

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

test('source discovery leaves out external file and directory links before content inspection', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/local.ts': 'export const local = true;\n',
        'outside/secret.ts': 'private outside bytes\n',
    });
    const root = join(directory.path, 'project');
    expect(processes.runBlocking(['git', 'init', '-q'], { cwd: root }).code).toBe(0);
    for (const [name, target] of [
        ['linked.ts', '../outside/secret.ts'],
        ['linked-directory', '../outside'],
    ] as const) {
        fs.symlinkSync(target, join(root, name));
        expect(processes.runBlocking(['git', 'add', '--', name], { cwd: root }).code).toBe(0);
        const repository = await readRepository(root, [], [], []);
        expect(repository.files.map((file) => file.path)).toStrictEqual(['local.ts']);
        expect(() => readPrefix(root, name, 64)).toThrow('Source link leaves the repository');
        fs.unlinkSync(join(root, name));
        expect(processes.runBlocking(['git', 'rm', '--cached', '--', name], { cwd: root }).code).toBe(0);
    }
    expect(fs.readFileSync(join(directory.path, 'outside/secret.ts'), 'utf8')).toBe('private outside bytes\n');
    fs.symlinkSync('local.ts', join(root, 'linked.ts'));
    expect(processes.runBlocking(['git', 'add', 'linked.ts'], { cwd: root }).code).toBe(0);
    const corrected = await readRepository(root, [], [], []);
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toContain('symlink');
    expect(readPrefix(root, 'linked.ts', 64).toString('utf8')).toBe('export const local = true;\n');
});

test('source reads refuse an escape introduced after inventory and accept an internal replacement', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/source.ts': 'export const value = 1;\n',
        'outside.ts': 'external content',
    });
    const root = join(sandbox.path, 'project');
    const repository = await readRepository(root, [], [], []);
    expect(repository.files.map((file) => file.path)).toStrictEqual(['source.ts']);
    fs.unlinkSync(join(root, 'source.ts'));
    fs.symlinkSync('../outside.ts', join(root, 'source.ts'));
    expect(() => readSource(root, repository.files[0]!.path)).toThrow('Source link leaves the repository');
    expect(() => readSource(root, '../outside.ts')).toThrow();
    fs.unlinkSync(join(root, 'source.ts'));
    await Bun.write(join(root, 'owned.ts'), 'export const value = 2;\n');
    fs.symlinkSync('owned.ts', join(root, 'source.ts'));
    expect(readSource(root, 'source.ts').toString('utf8')).toBe('export const value = 2;\n');
    expect(fs.readFileSync(join(sandbox.path, 'outside.ts'), 'utf8')).toBe('external content');
});

// Windows file names cannot hold a newline or a quote.
test.skipIf(!isPosix)(
    'a non-Git walk preserves newline directories, nested negations, pruning, and link boundaries',
    async () => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, 'project');
        await createFileTree(sandbox.path, {
            'project/.gitignore': '*.log\npruned/\n',
            'project/source\nfiles/.gitignore': '!keep.log\nlocal.ts\n',
            'project/source\nfiles/keep.log': 'retained',
            'project/source\nfiles/drop.log': 'ignored',
            'project/source\nfiles/local.ts': 'ignored',
            'project/source\nfiles/code.ts': 'export {};\n',
            'project/pruned/.gitignore': '!keep.ts\n',
            'project/pruned/keep.ts': 'ignored with its parent',
            'outside/private.ts': 'external bytes',
        });
        fs.symlinkSync('../../outside', join(root, 'pruned', 'external'));
        fs.symlinkSync('source\nfiles', join(root, 'linked-directory'));
        const entries = await trackedEntries(root);
        expect(entries.map((entry) => entry.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
            '.gitignore',
            'source\nfiles/.gitignore',
            'source\nfiles/code.ts',
            'source\nfiles/keep.log',
        ]);
        fs.symlinkSync('../outside/private.ts', join(root, 'external.ts'));
        const linked = await trackedEntries(root);
        expect(linked.map((entry) => entry.path)).toStrictEqual(entries.map((entry) => entry.path));
        fs.unlinkSync(join(root, 'external.ts'));
        const unlinked = await trackedEntries(root);
        expect(unlinked.map((entry) => entry.path)).toStrictEqual(entries.map((entry) => entry.path));
    },
);

test.skipIf(!isPosix)('a non-Git walk omits named pipes from readable source files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.runBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    const entries = await trackedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
});

test.skipIf(!isPosix)('Bash findings retain newline and colon directory names without Git', async () => {
    await using sandbox = await testdir();
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['bash/syntax'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(
        [...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(paths);
    for (const path of paths) writeFileSync(join(sandbox.path, path), 'printf "%s\\n" "Hello"\n');
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
});

test('source reads never cache isolated output or turn failed reads into success', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'original' });
    await createFileTree(scratch.path, { 'source.txt': 'before generation' });
    const reads = { root: sandbox.path, sources: new Map<string, Buffer>(), memo: new Map() };
    expect(readSource(sandbox.path, 'source.txt', reads).toString()).toBe('original');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('before generation');
    await Bun.write(join(scratch.path, 'source.txt'), 'after generation');
    expect(readSource(scratch.path, 'source.txt', reads).toString()).toBe('after generation');
    expect(() => readSource(sandbox.path, 'missing.txt', reads)).toThrow('missing.txt');
    await Bun.write(join(sandbox.path, 'missing.txt'), 'recovered');
    expect(readSource(sandbox.path, 'missing.txt', reads).toString()).toBe('recovered');
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('original');
});
