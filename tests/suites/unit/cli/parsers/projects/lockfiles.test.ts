import { posix } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readLockedPackages, readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { PYTHON_LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

import {
    LOCKED_PACKAGE_CASES,
    LOCKED_VERSION_CASES,
    LOCKED_VERSIONS_MANIFEST,
} from '#tests/config/parsers/projects/lockfiles.ts';

test.each([...LOCKED_VERSION_CASES])(
    '$name reads the direct dependency versions of its importer',
    async ({ file, folder, text }) => {
        await using sandbox = await testdir({
            [posix.join(folder, 'package.json')]: LOCKED_VERSIONS_MANIFEST,
            [file]: text,
        });
        expect(readLockedVersions(createReadCache(sandbox.path), folder, JAVASCRIPT_LOCKFILES)).toStrictEqual(
            new Map([
                ['react', '18.3.1'],
                ['react-dom', '18.3.1'],
            ]),
        );
    },
);

test.each([...LOCKED_PACKAGE_CASES])(
    'locked packages: $name lists each package as name@version',
    async ({ file, lockfiles, text, expected }) => {
        await using sandbox = await testdir({ [file]: text });
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
