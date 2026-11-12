import { describe, expect, test } from 'bun:test';
import { stringify } from 'yaml';

import { isLockfileFresh, stripBunRegistryUrls } from '#cli/tools/installers/npm/lockfiles.ts';

const ROOT_DEPENDENCIES = [
    {
        name: 'npm with root development dependencies',
        manager: 'npm',
        source: '{"packages":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"node_modules/eslint":{"version":"9.39.5","integrity":"sha512-YQ=="},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}}}',
        expected: { eslint: '9.39.5' },
    },
    {
        name: 'npm without development dependencies',
        manager: 'npm',
        source: '{"packages":{"":{"dependencies":{"runtime":"1.0.0"}}}}',
        expected: {},
    },
    {
        name: 'bun with root development dependencies',
        manager: 'bun',
        source: '{"workspaces":{"":{"devDependencies":{"eslint":"9.39.5"},"dependencies":{"runtime":"1.0.0"}},"apps/api":{"devDependencies":{"typescript":"5.9.3"}}},"packages":{"eslint":["eslint@9.39.5","",{},"sha512-YQ=="]}}',
        expected: { eslint: '9.39.5' },
    },
    { name: 'bun without development dependencies', manager: 'bun', source: '{"workspaces":{}}', expected: {} },
    {
        name: 'pnpm with root development dependencies',
        manager: 'pnpm',
        source: `importers:
  .:
    devDependencies:
      eslint:
        specifier: 9.39.5
        version: 9.39.5
    dependencies:
      runtime:
        specifier: 1.0.0
  apps/api:
    devDependencies:
      typescript:
        specifier: 5.9.3
packages:
  eslint@9.39.5:
    resolution:
      integrity: sha512-YQ==
`,
        expected: { eslint: '9.39.5' },
    },
] as const;

const LOCKFILE_REGISTRY = { npm_config_registry: 'https://registry.npmjs.org/' };

const LOCKFILE_SECURITY_CASES = [
    ['portable package', 'is-number', '7.0.0', '', true],
    ['identity swap', 'left-pad', '1.3.0', '', false],
    ['root downgrade', 'is-number', '6.0.0', '', false],
    ['registry tarball swap', 'is-number', '7.0.0', 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz', false],
    ['standard tarball', 'is-number', '7.0.0', 'https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz', true],
] as const;

const LOCKFILE_REGISTRY_CASES = [
    [
        'public tarball outside the private default registry',
        'is-number',
        '7.0.0',
        'https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz',
        false,
        { npm_config_registry: 'https://packages.example/' },
        'is-number',
    ],
    [
        'exact private default registry tarball',
        'is-number',
        '7.0.0',
        'https://packages.example/is-number/-/is-number-7.0.0.tgz',
        true,
        { npm_config_registry: 'https://packages.example/' },
        'is-number',
    ],
    [
        'public tarball explicitly selected for a scope',
        '@example/package',
        '7.0.0',
        'https://registry.npmjs.org/@example/package/-/package-7.0.0.tgz',
        true,
        {
            npm_config_registry: 'https://packages.example/',
            'npm_config_@example:registry': 'https://registry.npmjs.org/',
        },
        '@example/package',
    ],
    [
        'public tarball outside a private scope registry',
        '@example/package',
        '7.0.0',
        'https://registry.npmjs.org/@example/package/-/package-7.0.0.tgz',
        false,
        {
            npm_config_registry: 'https://registry.npmjs.org/',
            'npm_config_@example:registry': 'https://packages.example/',
        },
        '@example/package',
    ],
] as const;

test.each([...ROOT_DEPENDENCIES])(
    'a $name lockfile is current only with the root development dependencies',
    ({ manager, source, expected }) => {
        expect(isLockfileFresh(manager, source, expected, LOCKFILE_REGISTRY)).toBe(true);
        expect(isLockfileFresh(manager, source, { ...expected, unrelated: '1.0.0' }, LOCKFILE_REGISTRY)).toBe(false);
    },
);

describe.each(['bun', 'npm', 'pnpm'] as const)('%s tool lockfile', (packageManager) => {
    test.each([
        ...LOCKFILE_SECURITY_CASES.map((row) => [...row, LOCKFILE_REGISTRY, 'is-number'] as const),
        ...(packageManager === 'bun' ? LOCKFILE_REGISTRY_CASES : []),
    ])('%s preserves the pinned package identity', (_scenario, name, version, address, expected, env, dependency) => {
        const dependencies = { [dependency]: '7.0.0' };
        const integrity = 'sha512-YQ==';
        let content: string;
        if (packageManager === 'bun')
            content = JSON.stringify({
                workspaces: { '': { devDependencies: dependencies } },
                packages: { [dependency]: [`${name}@${version}`, address, {}, integrity] },
            });
        else if (packageManager === 'npm')
            content = JSON.stringify({
                packages: {
                    '': { devDependencies: dependencies },
                    [`node_modules/${dependency}`]: { name, version, resolved: address, integrity },
                },
            });
        else
            content = stringify({
                importers: { '.': { devDependencies: { [dependency]: { specifier: '7.0.0', version } } } },
                packages: {
                    [`${dependency}@${version}`]: {
                        name,
                        resolution: { integrity, ...(address !== '' && { tarball: address }) },
                    },
                },
            });
        expect(isLockfileFresh(packageManager, content, dependencies, env)).toBe(expected);
    });
});

test('a Bun package alias that names another package is refused', () => {
    const dependencies = { 'is-number': '7.0.0' };
    const buildLockfile = (identity: string): string =>
        JSON.stringify({
            workspaces: { '': { devDependencies: dependencies } },
            packages: {
                'is-number': ['is-number@7.0.0', '', {}, 'sha512-YQ=='],
                other: [identity, '', {}, 'sha512-YQ=='],
            },
        });
    expect(isLockfileFresh('bun', buildLockfile('other@1.0.0'), dependencies, LOCKFILE_REGISTRY)).toBe(true);
    expect(isLockfileFresh('bun', buildLockfile('other@npm:crafted@1.0.0'), dependencies, LOCKFILE_REGISTRY)).toBe(
        false,
    );
});

test('Bun registry stripping preserves every byte outside the selected tarball address', () => {
    const source =
        '{\n  "workspaces": {},\n  "packages": {\n    "first": ["first@1.0.0", "https://registry.npmjs.org/first/-/first-1.0.0.tgz", {}, "sha512-YQ=="],\n    "other": ["other@1.0.0", "https://other.example/other/-/other-1.0.0.tgz", {}, "sha512-YQ=="]\n  }\n}\n';
    expect(stripBunRegistryUrls(source, LOCKFILE_REGISTRY)).toBe(
        source.replace('https://registry.npmjs.org/first/-/first-1.0.0.tgz', ''),
    );
});

test('a pnpm lockfile with an extra root development dependency is stale', () => {
    const source = stringify({
        importers: { '.': { devDependencies: { extra: { specifier: '1.0.0', version: '1.0.0' } } } },
        packages: {},
    });
    expect(isLockfileFresh('pnpm', source, {}, LOCKFILE_REGISTRY)).toBe(false);
});

test('a tool pnpm lockfile in the two-document form is fresh when its pins match', () => {
    const packageManagerLock = stringify({
        lockfileVersion: '9.0',
        importers: {
            '.': {
                configDependencies: {},
                packageManagerDependencies: { pnpm: { specifier: '12.0.0', version: '12.0.0' } },
            },
        },
        packages: { 'pnpm@12.0.0': { resolution: { integrity: 'sha512-YQ==' } } },
    });
    const projectLock = stringify({
        lockfileVersion: '9.0',
        importers: { '.': { devDependencies: { 'is-number': { specifier: '7.0.0', version: '7.0.0' } } } },
        packages: { 'is-number@7.0.0': { resolution: { integrity: 'sha512-YQ==' } } },
    });
    const source = `---\n${packageManagerLock}\n---\n${projectLock}`;
    expect(isLockfileFresh('pnpm', source, { 'is-number': '7.0.0' }, LOCKFILE_REGISTRY)).toBe(true);
});
