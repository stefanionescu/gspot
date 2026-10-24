import { stringify } from 'yaml';
import { test, expect, describe } from 'bun:test';
import { isLockfileFresh } from '#cli/install/npm/lockfiles.ts';
import { ROOT_DEPENDENCIES, LOCKFILE_REGISTRY, LOCKFILE_SECURITY_CASES } from '#tests/config/install/npm/lockfiles.ts';

test.each(ROOT_DEPENDENCIES)(
    'a %s lockfile is current only with the root development dependencies',
    (name, source, expected) => {
        expect(isLockfileFresh(name, source, expected, LOCKFILE_REGISTRY)).toBe(true);
        expect(isLockfileFresh(name, source, { ...expected, unrelated: '1.0.0' }, LOCKFILE_REGISTRY)).toBe(false);
    },
);

describe.each(['bun', 'npm', 'pnpm'] as const)('%s tool lockfile', (packageManager) => {
    test.each(LOCKFILE_SECURITY_CASES)(
        '%s preserves the pinned package identity',
        (_scenario, name, version, address, expected) => {
            const dependencies = { 'is-number': '7.0.0' };
            const integrity = 'sha512-YQ==';
            let content: string;
            if (packageManager === 'bun')
                content = JSON.stringify({
                    workspaces: { '': { devDependencies: dependencies } },
                    packages: { 'is-number': [`${name}@${version}`, address, {}, integrity] },
                });
            else if (packageManager === 'npm')
                content = JSON.stringify({
                    packages: {
                        '': { devDependencies: dependencies },
                        'node_modules/is-number': { name, version, resolved: address, integrity },
                    },
                });
            else
                content = stringify({
                    importers: { '.': { devDependencies: { 'is-number': { specifier: '7.0.0', version } } } },
                    packages: {
                        [`is-number@${version}`]: {
                            name,
                            resolution: { integrity, ...(address === '' ? {} : { tarball: address }) },
                        },
                    },
                });
            expect(isLockfileFresh(packageManager, content, dependencies, LOCKFILE_REGISTRY)).toBe(expected);
        },
    );
});
