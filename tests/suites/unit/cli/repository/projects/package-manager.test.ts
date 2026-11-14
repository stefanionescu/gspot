import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { detectPackageManager } from '#cli/repository/projects/package-manager.ts';

const PACKAGE_MANAGER_PIN_CASES = [
    [
        'a packageManager with a hash suffix',
        { 'package.json': '{"packageManager":"pnpm@9.1.0+sha512.0a1b2c"}' },
        'pnpm@9.1.0',
    ],
    [
        'an exact devEngines version',
        { 'package.json': '{"devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}' },
        'yarn@4.2.0',
    ],
    [
        'an explicit manager before a competing lockfile and devEngines declaration',
        {
            'package.json':
                '{"packageManager":"npm@10.9.0","devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}',
            'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        },
        'npm@10.9.0',
    ],
    [
        'the first devEngines manager in a list',
        {
            'package.json':
                '{"devEngines":{"packageManager":[{"name":"yarn","version":"4.2.0"},{"name":"npm","version":"10.9.0"}]}}',
        },
        'yarn@4.2.0',
    ],
] as const;

const REFUSED_PACKAGE_MANAGER_PINS = [
    {
        written: '^9.1.0',
        field: 'devEngines.packageManager',
        packageJson: '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
    },
    { written: 'pnpm@^9.1.0', field: 'packageManager', packageJson: '{"packageManager":"pnpm@^9.1.0"}' },
    { written: 'pnpm', field: 'packageManager', packageJson: '{"packageManager":"pnpm"}' },
    { written: 'cnpm@9.0.0', field: 'packageManager', packageJson: '{"packageManager":"cnpm@9.0.0"}' },
    { written: 'pnpm@9.0.0@x', field: 'packageManager', packageJson: '{"packageManager":"pnpm@9.0.0@x"}' },
    {
        written: '9.0.0',
        field: 'devEngines.packageManager',
        packageJson: '{"devEngines":{"packageManager":{"name":"cnpm","version":"9.0.0"}}}',
    },
] as const;

test.each([...PACKAGE_MANAGER_PIN_CASES])(
    '%s names the package manager and its version',
    async (_, files, expected) => {
        await using sandbox = await createGitSandbox(files);

        const { name, version } = detectPackageManager(sandbox.path, []);
        expect([name, version]).toStrictEqual(expected.split('@'));
    },
);

test.each([...REFUSED_PACKAGE_MANAGER_PINS])(
    'a package manager pin gspot cannot use is refused with its field and written value: $written',
    async ({ written, field, packageJson }) => {
        await using sandbox = await createGitSandbox({ 'package.json': packageJson });

        const error = await captureRejection(Promise.try(() => detectPackageManager(sandbox.path, [])));
        expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
        expect(error.message).toContain(`"${written}"`);
        expect(error.message).toContain(field);
    },
);

test('a lockfile beside a later nested package selects its manager', async () => {
    await using sandbox = await testdir({
        'apps/admin/package.json': '{"private":true}',
        'web/package.json': '{"private":true}',
        'web/pnpm-lock.yaml': 'lockfileVersion: "9.0"\n',
    });
    expect(detectPackageManager(sandbox.path, ['web/package.json', 'apps/admin/package.json'])).toStrictEqual({
        name: 'pnpm',
    });
});

test('with no pin and no lockfile, the package manager is npm', async () => {
    await using sandbox = await testdir({ 'package.json': '{"private":true}' });
    expect(detectPackageManager(sandbox.path, [])).toStrictEqual({ name: 'npm' });
});

test('the first nested package by name selects the package manager, in any order of the tracked paths', async () => {
    await using sandbox = await testdir({
        'apps/web/package.json': '{"private":true,"packageManager":"npm@11.19.0"}',
        'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    });
    expect(detectPackageManager(sandbox.path, ['other/package.json', 'apps/web/package.json'])).toMatchObject({
        name: 'npm',
        version: '11.19.0',
    });
});
