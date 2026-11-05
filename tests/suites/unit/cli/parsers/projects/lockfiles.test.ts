import { posix } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { LOCKED_VERSION_CASES } from '#tests/config/parsers/formats.ts';

test.each([...LOCKED_VERSION_CASES])(
    '$name reads the direct dependency versions of its importer',
    async ({ file, folder, text }) => {
        await using sandbox = await testdir({
            [posix.join(folder, 'package.json')]: '{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}',
            [file]: text,
        });
        expect(readLockedVersions(createRunCache(sandbox.path), folder)).toStrictEqual(
            new Map([
                ['react', '18.3.1'],
                ['react-dom', '18.3.1'],
            ]),
        );
    },
);
