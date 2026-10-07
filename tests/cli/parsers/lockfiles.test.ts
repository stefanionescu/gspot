// The package identities each supported lockfile format resolves, and the formats and files it refuses.
import { test, expect } from 'bun:test';
import { lockfilePackages } from '#cli/parsers/lockfiles.ts';
import { LOCKFILE_CASES } from '#tests/config/cli/parsers/lockfiles.ts';

test.each(LOCKFILE_CASES)('%s resolves the package to its locked version', (filename, lockfile) => {
    expect(lockfilePackages(filename, lockfile)).toStrictEqual(new Set(['example@1.2.3']));
});

test.each([
    ['package-lock.json', 'JSON Parse error'],
    ['uv.lock', 'Invalid TOML document'],
])('malformed %s cannot prove exception membership', (filename, diagnostic) => {
    expect(() => lockfilePackages(filename, '{ broken lockfile')).toThrow(diagnostic);
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
    const identities = lockfilePackages('package-lock.json', nested);
    expect(identities).toStrictEqual(lockfilePackages('package-lock.json', flat));
    expect(identities.has('is-number@7.0.0')).toBe(true);
    expect(identities.has('named-alias@7.0.0')).toBe(false);
    expect(identities.has('example@1.0.0')).toBe(true);
    expect(identities.has('example@2.0.0')).toBe(true);
});

test('Yarn nested aliases retain resolved names instead of installation names', () => {
    const lockfile = `# yarn lockfile v1
"named-alias@npm:is-number@7.0.0":
  version "7.0.0"
"types-alias@npm:@types/is-number@7.0.5":
  version "7.0.5"
"@types/is-number@7.0.5":
  version "7.0.5"
`;
    expect(lockfilePackages('yarn.lock', lockfile)).toStrictEqual(
        new Set(['is-number@7.0.0', '@types/is-number@7.0.5']),
    );
});

test.each(['unknown.lock', '__proto__'])('unsupported lockfile format %s retains the format error', (filename) => {
    expect(() => lockfilePackages(filename, '{}')).toThrow(
        `Cannot read packages from ${filename}. gspot reads uv.lock, poetry.lock, pdm.lock, package-lock.json, bun.lock, pnpm-lock.yaml, and yarn.lock.`,
    );
});
