import { test, expect } from 'bun:test';
import { pythonLockMatches } from '#cli/tools/python/lockfiles.ts';
import { UV_LOCK_MISMATCHES, PRIVATE_PYTHON_LOCK, PRIVATE_PYTHON_PROJECT } from '#tests/config/samples/python/tools.ts';

test('private Python lock comparison normalizes distribution names and ignores requirement order', () => {
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCK)).toBe(true);
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, 'not valid =')).toBe(false);
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT.replace('==1.2.3', '>=1.2.3'), PRIVATE_PYTHON_LOCK)).toBe(false);
});

test.each(UV_LOCK_MISMATCHES)('a changed %s makes a private Python lock stale', (_name, before, after) => {
    expect(pythonLockMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCK.replace(before, after))).toBe(false);
});
