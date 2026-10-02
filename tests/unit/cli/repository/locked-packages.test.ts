// The package identities each supported lockfile format resolves, and the formats and files it refuses.
import { test, expect } from 'bun:test';
import { lockedPackages } from '#cli/repository/locked-packages.ts';

const LOCKS: [string, string][] = [
    [
        'package-lock.json',
        JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/example': { version: '1.2.3' } } }),
    ],
    ['bun.lock', '{"lockfileVersion":1,"packages":{"example":["example@1.2.3","",{},"sha512-fixture"]}}'],
    ['pnpm-lock.yaml', 'lockfileVersion: "9.0"\npackages:\n  example@1.2.3(peer@2.0.0): {}\n'],
    [
        'yarn.lock',
        '__metadata:\n  version: 8\n  cacheKey: 10c0\n"example@npm:^1.0.0":\n  version: 1.2.3\n  resolution: "example@npm:1.2.3"\n',
    ],
    ['uv.lock', 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['poetry.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['pdm.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
];

test.each(LOCKS)('%s resolves the package to its locked version', (filename, lock) => {
    expect(lockedPackages(filename, lock).has('example@1.2.3')).toBe(true);
});

test.each(['package-lock.json', 'uv.lock'])('malformed %s cannot prove exception membership', (filename) => {
    expect(() => lockedPackages(filename, '{ broken lockfile')).toThrow();
});

test('npm lockfiles retain resolved alias names, scoped names, and nested versions', () => {
    const nested = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
            '@types/is-number': { version: '7.0.5' },
            'named-alias': { version: 'npm:is-number@7.0.0', dependencies: { example: { version: '2.0.0' } } },
            example: { version: '1.0.0' },
        },
    });
    const flat = JSON.stringify({
        lockfileVersion: 3,
        packages: {
            'node_modules/@types/is-number': { version: '7.0.5' },
            'node_modules/named-alias': { name: 'is-number', version: '7.0.0' },
            'node_modules/named-alias/node_modules/example': { version: '2.0.0' },
            'node_modules/example': { version: '1.0.0' },
        },
    });
    const identities = lockedPackages('package-lock.json', nested);
    expect(identities).toStrictEqual(lockedPackages('package-lock.json', flat));
    expect(identities.has('is-number@7.0.0')).toBe(true);
    expect(identities.has('named-alias@7.0.0')).toBe(false);
    expect(identities.has('example@1.0.0')).toBe(true);
    expect(identities.has('example@2.0.0')).toBe(true);
});

test('Yarn nested aliases retain resolved names instead of installation names', () => {
    const lock = `# yarn lockfile v1
"named-alias@npm:is-number@7.0.0":
  version "7.0.0"
"types-alias@npm:@types/is-number@7.0.5":
  version "7.0.5"
"@types/is-number@7.0.5":
  version "7.0.5"
`;
    expect(lockedPackages('yarn.lock', lock)).toStrictEqual(new Set(['is-number@7.0.0', '@types/is-number@7.0.5']));
});

test.each(['unknown.lock', '__proto__'])('unsupported lock format %s retains the format error', (filename) => {
    expect(() => lockedPackages(filename, '{}')).toThrow(
        'This lockfile format does not support package exception verification.',
    );
});
