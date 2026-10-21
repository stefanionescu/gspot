import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readLockedPackages } from '#cli/parsers/lockfiles.ts';
import { LOCKED_PACKAGE_CASES } from '#tests/data/parsers/lockfiles.ts';
import { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';

test.each([...LOCKED_PACKAGE_CASES])(
    'locked packages: $file lists each package as name@version',
    async ({ file, text, expected }) => {
        await using sandbox = await testdir({ [file]: text });
        const lockfiles = file === 'uv.lock' ? PYTHON_LOCKFILES : JAVASCRIPT_LOCKFILES;
        const locked = readLockedPackages(createReadCache(sandbox.path), '', lockfiles);
        expect([...(locked ?? [])].toSorted((left, right) => left.localeCompare(right))).toStrictEqual([...expected]);
    },
);

test('locked packages: a project folder reads the nearest lockfile on the way to the root, or none', async () => {
    await using sandbox = await testdir({ 'bun.lock': '{"packages":{"zod":["zod@4.0.0","",{},"sha"]}}' });
    const reads = createReadCache(sandbox.path);
    expect(readLockedPackages(reads, 'apps/web', JAVASCRIPT_LOCKFILES)).toStrictEqual(new Set(['zod@4.0.0']));
    expect(readLockedPackages(reads, 'apps/web', PYTHON_LOCKFILES)).toBeUndefined();
});
