import { describe, expect, test } from 'bun:test';
import type { TrackedFile } from '#cli/repository/types.ts';
import { directoryOf, directoryTree, prefixOf, stemOf } from '#cli/structure/directories.ts';

function tracked(path: string): TrackedFile {
    return { path, prefix: Buffer.alloc(0), nature: 'source', tags: ['text'], executable: false, size: 1 };
}

describe('the tracked directory tree', () => {
    test('lists files and the folders they imply, sorted', () => {
        const tree = directoryTree([tracked('src/a/x.ts'), tracked('src/b.ts'), tracked('README.md')]);
        expect(tree.get('')).toEqual([
            { name: 'README.md', kind: 'file' },
            { name: 'src', kind: 'dir' },
        ]);
        expect(tree.get('src')).toEqual([
            { name: 'a', kind: 'dir' },
            { name: 'b.ts', kind: 'file' },
        ]);
    });

    test('stems, prefixes and directories', () => {
        expect(directoryOf('a/b/c.ts')).toBe('a/b');
        expect(directoryOf('c.ts')).toBe('');
        expect(stemOf('x/modules.d.ts')).toBe('modules');
        expect(prefixOf('asset-card')).toBe('asset');
        expect(prefixOf('bash.test')).toBe('bash');
    });
});
