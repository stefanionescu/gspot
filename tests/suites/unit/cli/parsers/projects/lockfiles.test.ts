import { posix } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { LOCKED_VERSION_CASES } from '#tests/config/parsers/formats.ts';
import { readLockedVersions, findLockedPackageLine } from '#cli/parsers/projects/lockfiles.ts';

const PACKAGE_LINE_CASES = [
    {
        name: 'its name entry in a TOML lockfile, after a package that depends on it',
        text: '[[package]]\nname = "app"\ndependencies = [\n    { name = "strict" },\n]\n\n[[package]]\nname = "strict"\nversion = "1.0.0"\n',
        expected: 8,
    },
    {
        name: 'its node_modules entry in an npm lockfile, after the dependency list and a scoped package of the same name',
        text: '{\n"packages": {\n"": { "dependencies": { "strict": "1.0.0" } },\n"node_modules/@scope/strict": {},\n"node_modules/strict": {\n"version": "1.0.0"\n}}}\n',
        expected: 5,
    },
    {
        name: 'the line that holds its name and its version',
        text: '# strict is pinned below\nstricter==1.0.0\nstrict==1.0.0\n',
        expected: 3,
    },
    {
        name: 'the first line that holds its name when no line holds the version',
        text: '__metadata:\n  version: 8\n"strict@npm:^1":\n  checksum: none\n',
        expected: 3,
    },
    { name: '1 when the lockfile does not write the name', text: '{}\n', expected: 1 },
] as const;

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

test.each(PACKAGE_LINE_CASES)('the line of a locked package is $name', ({ text, expected }) => {
    expect(findLockedPackageLine(text, 'strict', '1.0.0')).toBe(expected);
});
