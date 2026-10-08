// Tool-project lockfile checks retain each manager's root development requirements.
import { test, expect } from 'bun:test';
import { rootLockfileDependencies } from '#cli/parsers/contracts.ts';
import { ROOT_DEPENDENCIES } from '#tests/config/cli/parsers/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)('%s reads only its root development requirements', (name, source, expected) => {
    expect(rootLockfileDependencies(name, source)).toStrictEqual(expected);
});
