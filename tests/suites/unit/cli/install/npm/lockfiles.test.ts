import { test, expect } from 'bun:test';
import { isLockfileFresh } from '#cli/install/npm/lockfiles.ts';
import { ROOT_DEPENDENCIES } from '#tests/config/install/npm/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)(
    'a %s lockfile is current only with the root development dependencies',
    (name, source, expected) => {
        expect(isLockfileFresh(name, source, expected)).toBe(true);
        expect(isLockfileFresh(name, source, { ...expected, unrelated: '1.0.0' })).toBe(false);
    },
);
