import { test, expect } from 'bun:test';
import { isLockfileCurrent } from '#cli/install/npm/lockfiles.ts';
import { ROOT_DEPENDENCIES } from '#tests/config/install/npm/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)(
    'a %s lockfile is current only with the root development dependencies',
    (name, source, expected) => {
        expect(isLockfileCurrent(name, source, expected)).toBe(true);
        expect(isLockfileCurrent(name, source, { ...expected, unrelated: '1.0.0' })).toBe(false);
    },
);
