import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { readRepository } from '#cli/repository/tree.ts';
import { natureOf, resetNatures } from '#cli/repository/natures.ts';

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
        resetNatures();
        const root = sandbox.path;
        expect(natureOf(root, 'src/a.ts', [{ paths: ['src/a.ts'], produced_by: 'gen' }], false, true)).toEqual({
            nature: 'generated',
            source: 'declare',
            producedBy: 'gen',
        });
        expect(natureOf(root, 'generated/x.ts', [], false, true).source).toBe('.gitattributes');
        expect(natureOf(root, 'types.ts', [], false, true).nature).toBe('generated');
        expect(natureOf(root, 'vendor/lib.js', [], false, true).nature).toBe('vendored');
        expect(natureOf(root, 'assets/a.bin', [], false, true).nature).toBe('binary');
        expect(natureOf(root, 'src/a.ts', [], false, true).nature).toBe('source');
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
