import { test, expect } from 'bun:test';
import { ROOT_DEPENDENCIES } from '#tests/config/npm.ts';
import { rootLockfileDependencies } from '#cli/tools/npm/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)('%s lockfile: only the root dev dependencies', (name, source, expected) => {
    expect(rootLockfileDependencies(name, source)).toStrictEqual(expected);
});
