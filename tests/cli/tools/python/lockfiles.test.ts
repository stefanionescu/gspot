import { test, expect } from 'bun:test';
import { pythonLockfileMatches } from '#cli/tools/python/contracts.ts';

import {
    PRIVATE_PYTHON_PROJECT,
    UV_LOCKFILE_MISMATCHES,
    PRIVATE_PYTHON_LOCKFILE,
} from '#tests/config/samples/python.ts';

test('private Python lockfile comparison normalizes distribution names and ignores requirement order', () => {
    expect(pythonLockfileMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCKFILE)).toBe(true);
    expect(pythonLockfileMatches(PRIVATE_PYTHON_PROJECT, 'not valid =')).toBe(false);
    expect(pythonLockfileMatches(PRIVATE_PYTHON_PROJECT.replace('==1.2.3', '>=1.2.3'), PRIVATE_PYTHON_LOCKFILE)).toBe(
        false,
    );
});

test.each(UV_LOCKFILE_MISMATCHES)('a changed %s makes a private Python lockfile drift', (_name, before, after) => {
    expect(pythonLockfileMatches(PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCKFILE.replace(before, after))).toBe(false);
});
