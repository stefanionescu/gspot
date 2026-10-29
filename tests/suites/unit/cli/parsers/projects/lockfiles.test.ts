import { posix } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { LOCKED_VERSION_CASES } from '#tests/config/parsers/projects/lockfiles.ts';

test.each([...LOCKED_VERSION_CASES])(
    '$name reads the direct dependency versions of its importer',
    async ({ file, folder, text }) => {
        await using sandbox = await testdir({
            [posix.join(folder, 'package.json')]: '{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}',
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
