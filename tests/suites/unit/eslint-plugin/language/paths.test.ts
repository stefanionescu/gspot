import { test, expect } from 'bun:test';
import { findPathInRoot } from '#eslint-plugin/language/paths.ts';

test('a root setting that is not a string counts as unset', () => {
    const path = findPathInRoot({
        cwd: '/repo',
        physicalFilename: '/repo/src/cart.ts',
        settings: { gspot: { root: 1 } },
    });
    expect(path).toBe('src/cart.ts');
});
