import * as fs from 'node:fs';
import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { statSync, writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { readRepository } from '#cli/repository/tree.ts';
import { findRoot, head, isGitRepository, trackedEntries, readSource } from '#cli/repository/tracked.ts';

describe('repository file discovery', () => {
    test('excluded links are omitted before resolving external targets', async () => {
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
        await rejects(readRepository(root, [], [], []), { message: /Source link leaves the repository/u });
        expect(fs.readFileSync(join(sandbox.path, 'outside.ts'), 'utf8')).toBe('private external bytes');
    });

    test('keeps tracked deletions out of readable entries', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
        expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
        expect(processes.runBlocking(['git', 'add', 'source.ts'], { cwd: sandbox.path }).code).toBe(0);
        fs.rmSync(join(sandbox.path, 'source.ts'));
        expect(await trackedEntries(sandbox.path)).toStrictEqual([]);
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
        expect(entries.map((entry) => entry.path)).toStrictEqual(['.gitignore', 'source.ts']);
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
        expect(entries.map((entry) => entry.path)).toStrictEqual(['source.ts']);
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
        'gspot.toml': 'version = 1\nconfigurations = []\n',
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

test('source discovery rejects external file and directory links before content inspection', async () => {
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
        await rejects(readRepository(root, [], [], []), { message: /Source link leaves the repository/u });
        expect(() => head(root, name)).toThrow('Source link leaves the repository');
        fs.unlinkSync(join(root, name));
        expect(processes.runBlocking(['git', 'rm', '--cached', '--', name], { cwd: root }).code).toBe(0);
    }
    expect(fs.readFileSync(join(directory.path, 'outside/secret.ts'), 'utf8')).toBe('private outside bytes\n');
    fs.symlinkSync('local.ts', join(root, 'linked.ts'));
    expect(processes.runBlocking(['git', 'add', 'linked.ts'], { cwd: root }).code).toBe(0);
    const corrected = await readRepository(root, [], [], []);
    expect(corrected.files.find((file) => file.path === 'linked.ts')?.tags).toContain('symlink');
    expect(head(root, 'linked.ts')).toBe('export const local = true;\n');
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

test('a managed secret baseline rejects linked bytes before evaluating entries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["secrets"]\n',
        'project/.gspot/.keep': '',
        'baseline.json': '[]\n',
    });
    const root = join(sandbox.path, 'project');
    const baseline = join(root, '.gspot/gitleaks-baseline.json');
    fs.symlinkSync('../../baseline.json', baseline);
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['integrity/gitleaks-baseline'],
        fix: false,
        isDryRun: false,
    };
    const refused = await executeRun(await openSession(root), options);
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]).toMatchObject({ status: 'error', findings: [] });
    expect(refused.report.checks[0]!.note).toContain('private regular file');
    fs.unlinkSync(baseline);
    await Bun.write(baseline, '[]\n');
    const corrected = await executeRun(await openSession(root), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(fs.readFileSync(join(sandbox.path, 'baseline.json'), 'utf8')).toBe('[]\n');
});

test('a non-Git walk preserves newline directories, nested negations, pruning, and link boundaries', async () => {
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
    expect(entries.map((entry) => entry.path).sort()).toStrictEqual([
        '.gitignore',
        'source\nfiles/.gitignore',
        'source\nfiles/code.ts',
        'source\nfiles/keep.log',
    ]);
    fs.symlinkSync('../outside/private.ts', join(root, 'external.ts'));
    expect((await trackedEntries(root)).map((entry) => entry.path)).toStrictEqual(entries.map((entry) => entry.path));
    fs.unlinkSync(join(root, 'external.ts'));
    expect((await trackedEntries(root)).map((entry) => entry.path)).toStrictEqual(entries.map((entry) => entry.path));
});

test.skipIf(process.platform === 'win32')('a non-Git walk omits named pipes from readable source files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    expect(processes.runBlocking(['mkfifo', 'stream.ts'], { cwd: sandbox.path }).code).toBe(0);
    expect((await trackedEntries(sandbox.path)).map((entry) => entry.path)).toStrictEqual(['source.ts']);
});

test.skipIf(process.platform === 'win32')(
    'Bash findings retain newline and colon directory names without Git',
    async () => {
        await using sandbox = await testdir();
        const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
            ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
        });
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['bash/syntax'],
            fix: false,
            isDryRun: false,
            noCache: true,
        };
        const broken = await executeRun(await openSession(sandbox.path), options);
        expect(broken.report.exitCode).toBe(1);
        expect([...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].sort()).toStrictEqual(
            paths,
        );
        for (const path of paths) writeFileSync(join(sandbox.path, path), 'printf "%s\\n" "Hello"\n');
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks[0]!.findings).toStrictEqual([]);
    },
);
