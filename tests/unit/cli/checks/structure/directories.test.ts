import { directoryOf, prefixOf, stemOf } from '#cli/checks/structure/directories.ts';
import { describe, expect, test } from 'bun:test';

describe('the tracked directory tree', () => {
    test('stems, prefixes and directories', () => {
        expect(directoryOf('a/b/c.ts')).toBe('a/b');
        expect(directoryOf('c.ts')).toBe('');
        expect(stemOf('x/modules.d.ts')).toBe('modules');
        expect(prefixOf('asset-card')).toBe('asset');
        expect(prefixOf('bash.test')).toBe('bash');
    });
});
