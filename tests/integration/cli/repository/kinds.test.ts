import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';

describe('kinds', () => {
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
        const declarations = [{ paths: ['src/a.ts'], produced_by: 'gen', kind: 'generated' as const }];
        const declared = await readRepository(sandbox.path, declarations, [], []);
        expect(declared.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
            kind: 'generated',
            kindSource: 'generated',
            producedBy: 'gen',
        });
        const repository = await readRepository(sandbox.path, [], [], []);
        const files = new Map(repository.files.map((file) => [file.path, file]));
        expect(files.get('generated/x.ts')?.kindSource).toBe('.gitattributes');
        expect(files.get('types.ts')?.kind).toBe('generated');
        expect(files.get('vendor/lib.js')?.kind).toBe('vendored');
        expect(files.get('assets/a.bin')?.kind).toBe('binary');
        expect(files.get('src/a.ts')?.kind).toBe('source');
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

test('each repository read reads current attributes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.ts': 'export {};\n' });
    const before = await readRepository(sandbox.path, [], [], []);
    expect(before.files[0]!.kind).toBe('source');
    writeFileSync(join(sandbox.path, '.gitattributes'), '*.ts linguist-generated\n');
    const after = await readRepository(sandbox.path, [], [], []);
    expect(after.files.find((file) => file.path === 'source.ts')!.kind).toBe('generated');
    expect(before.files[0]!.kind).toBe('source');
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
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files.find((file) => file.path === 'source.ts')).toMatchObject({
        kind: 'generated',
        kindSource: '.gitattributes',
    });
});
