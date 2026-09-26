import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

describe('natures', () => {
    test('declarations win, then .gitattributes, then banners, then vendored directories, then the sniff', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitattributes': 'generated/* linguist-generated\nassets/** -text\n',
            'types.ts': '// This file was automatically generated\nexport type A = 1;\n',
            'generated/x.ts': 'export const x = 1;\n',
            'vendor/lib.js': 'x',
            'assets/a.bin': 'x',
            'src/a.ts': 'export const a = 1;\n',
        });
        const declarations = [{ paths: ['src/a.ts'], produced_by: 'gen', nature: 'generated' as const }];
        const declared = await readRepository(sandbox.path, declarations, [], []);
        expect(declared.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
            nature: 'generated',
            natureSource: 'generated',
            producedBy: 'gen',
        });
        const repository = await readRepository(sandbox.path, [], [], []);
        const files = new Map(repository.files.map((file) => [file.path, file]));
        expect(files.get('generated/x.ts')?.natureSource).toBe('.gitattributes');
        expect(files.get('types.ts')?.nature).toBe('generated');
        expect(files.get('vendor/lib.js')?.nature).toBe('vendored');
        expect(files.get('assets/a.bin')?.nature).toBe('binary');
        expect(files.get('src/a.ts')?.nature).toBe('source');
    });

    test('readRepository lists files without git through the gitignore walk', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gitignore': 'ignored/\n',
            'ignored/x.txt': 'x',
            'kept.txt': 'x',
        });
        const repo = await readRepository(sandbox.path, [], [], []);
        expect(repo.hasGit).toBe(false);
        expect(repo.files.map((file) => file.path)).toStrictEqual(['.gitignore', 'kept.txt']);
        expect(repo.scopes[0]?.path).toBe('');
    });
});

test('each repository observation reads current attributes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    const before = await readRepository(sandbox.path, [], [], []);
    expect(before.files[0]!.nature).toBe('source');
    writeFileSync(join(sandbox.path, '.gitattributes'), '*.ts linguist-generated\n');
    const after = await readRepository(sandbox.path, [], [], []);
    expect(after.files.find((file) => file.path === 'source.ts')!.nature).toBe('generated');
    expect(before.files[0]!.nature).toBe('source');
});

test('an unreadable attributes file cannot become an empty rule set', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    mkdirSync(join(sandbox.path, '.gitattributes'));
    await rejects(readRepository(sandbox.path, [], [], []), {
        message: /Lifecycle destination is not a private regular file/u,
    });
    rmSync(join(sandbox.path, '.gitattributes'), { recursive: true });
    writeFileSync(join(sandbox.path, '.gitattributes'), '*.ts linguist-generated\n');
    expect(
        (await readRepository(sandbox.path, [], [], [])).files.find((file) => file.path === 'source.ts'),
    ).toMatchObject({ nature: 'generated', natureSource: '.gitattributes' });
});

test('runtime identities classify only the supplied repository files as generated', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'runtime.yml': 'key: value\n', 'source.yml': 'key: value\n' });
    const repository = await readRepository(sandbox.path, [], [], [], new Set(['runtime.yml']));
    expect(repository.files.find((file) => file.path === 'runtime.yml')).toMatchObject({
        nature: 'generated',
        natureSource: 'gspot',
        producedBy: 'gspot check',
    });
    expect(repository.files.find((file) => file.path === 'source.yml')?.nature).toBe('source');
    const unowned = await readRepository(sandbox.path, [], [], []);
    expect(unowned.files.find((file) => file.path === 'runtime.yml')?.nature).toBe('source');
});
