import { test, expect } from 'bun:test';
import { ROOT_DEPENDENCIES } from '#tests/config/npm.ts';
import { isLockfileCurrent } from '#cli/tools/npm/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)('%s lockfile: only the root dev dependencies', (name, source, expected) => {
    expect(isLockfileCurrent(name, source, expected)).toBe(true);
    expect(isLockfileCurrent(name, source, { ...expected, unrelated: '1.0.0' })).toBe(false);
});
