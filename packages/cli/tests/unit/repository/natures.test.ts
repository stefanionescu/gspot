import { describe, expect, test } from 'bun:test';
import { createFixture } from 'fs-fixture';

import { natureOf, resetNatures } from '#cli/repository/natures.ts';
import { tagEntry } from '#cli/repository/tags.ts';
import { readRepository } from '#cli/repository/tree.ts';

describe('natures', () => {
    test('declarations win, then .gitattributes, then banners, then vendored directories, then the sniff', async () => {
        await using fixture = await createFixture({
            '.gitattributes': 'generated/* linguist-generated\nassets/** -text\n',
            'types.ts': '// This file was automatically generated\nexport type A = 1;\n',
            'generated/x.ts': 'export const x = 1;\n',
            'vendor/lib.js': 'x',
            'assets/a.bin': 'x',
            'src/a.ts': 'export const a = 1;\n',
        });
        resetNatures();
        const root = fixture.path;
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

    test('tags come from extension, filename, shebang and content', async () => {
        await using fixture = await createFixture({
            hook: '#!/usr/bin/env bash\necho hi\n',
            'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
            Dockerfile: 'FROM x\n',
        });
        const hook = tagEntry(fixture.path, { path: 'hook', size: 20, executable: true, symlink: false });
        expect(hook.tags).toEqual(expect.arrayContaining(['shell', 'executable', 'shebang:shell', 'text']));
        expect(tagEntry(fixture.path, { path: 'a.png', size: 4, executable: false, symlink: false }).binary).toBe(true);
        expect(
            tagEntry(fixture.path, { path: 'Dockerfile', size: 7, executable: false, symlink: false }).tags,
        ).toContain('dockerfile');
    });

    test('readRepository lists files without git through the gitignore walk', async () => {
        await using fixture = await createFixture({
            '.gitignore': 'ignored/\n',
            'ignored/x.txt': 'x',
            'kept.txt': 'x',
        });
        const repository = await readRepository(fixture.path, [], []);
        expect(repository.hasGit).toBe(false);
        expect(repository.files.map((file) => file.path)).toEqual(['.gitignore', 'kept.txt']);
        expect(repository.scopes[0]?.path).toBe('');
    });
});
