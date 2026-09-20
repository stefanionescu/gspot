import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readRepository } from '#cli/repository/tree.ts';

describe('natures', () => {
    test('declarations win, then .gitattributes, then banners, then vendored directories, then the sniff', async () => {
        await using sandbox = await createSandbox({
            '.gitattributes': 'generated/* linguist-generated\nassets/** -text\n',
            'types.ts': '// This file was automatically generated\nexport type A = 1;\n',
            'generated/x.ts': 'export const x = 1;\n',
            'vendor/lib.js': 'x',
            'assets/a.bin': 'x',
            'src/a.ts': 'export const a = 1;\n',
        });
        const declares = [{ paths: ['src/a.ts'], produced_by: 'gen' }];
        const declared = await readRepository(sandbox.path, declares, []);
        expect(declared.files.find((file) => file.path === 'src/a.ts')).toMatchObject({
            nature: 'generated',
            natureSource: 'declare',
            producedBy: 'gen',
        });
        const repository = await readRepository(sandbox.path, [], []);
        const files = new Map(repository.files.map((file) => [file.path, file]));
        expect(files.get('generated/x.ts')?.natureSource).toBe('.gitattributes');
        expect(files.get('types.ts')?.nature).toBe('generated');
        expect(files.get('vendor/lib.js')?.nature).toBe('vendored');
        expect(files.get('assets/a.bin')?.nature).toBe('binary');
        expect(files.get('src/a.ts')?.nature).toBe('source');
    });

    test('readRepository lists files without git through the gitignore walk', async () => {
        await using sandbox = await createSandbox({
            '.gitignore': 'ignored/\n',
            'ignored/x.txt': 'x',
            'kept.txt': 'x',
        });
        const repo = await readRepository(sandbox.path, [], []);
        expect(repo.hasGit).toBe(false);
        expect(repo.files.map((file) => file.path)).toEqual(['.gitignore', 'kept.txt']);
        expect(repo.scopes[0]?.path).toBe('');
    });
});

test('each repository observation reads current attributes', async () => {
    await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
    const before = await readRepository(sandbox.path, [], []);
    expect(before.files[0]!.nature).toBe('source');
    writeFileSync(join(sandbox.path, '.gitattributes'), '*.ts linguist-generated\n');
    const after = await readRepository(sandbox.path, [], []);
    expect(after.files.find((file) => file.path === 'source.ts')!.nature).toBe('generated');
    expect(before.files[0]!.nature).toBe('source');
});

test('an unreadable attributes file cannot become an empty rule set', async () => {
    await using sandbox = await createSandbox({ 'source.ts': 'export {};\n' });
    mkdirSync(join(sandbox.path, '.gitattributes'));
    await rejects(readRepository(sandbox.path, [], []), { code: 'EISDIR' });
});
