// The package manager is inspected only when the isolated tool project needs a version requirement.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { chmod, unlink, symlink } from 'node:fs/promises';
import { rejection } from '#tests/harness/expectations.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/client.ts';
import { NON_EXACT_MANAGERS, PACKAGE_SELECTIONS } from '#tests/config/cli/tools/npm/client.ts';

test('without a declaration or Bun on the path, the tool project uses npm at the version it reports', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir();
    await createFileTree(bin.path, { npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });
    await chmod(join(bin.path, 'npm'), 0o755);
    using _environment = useEnvironment({ PATH: bin.path });
    const installer = await selectPackageInstaller(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(inspectPackageInstaller(sandbox.path, installer)).toStrictEqual({ name: 'npm', version: '10.9.0' });
});

test.each(PACKAGE_SELECTIONS)('%s names the package manager and its version', async (_, files, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, files);
    const { name, version } = await selectPackageInstaller(sandbox.path, []);
    expect([name, version]).toStrictEqual(expected.split('@'));
});

test.each(NON_EXACT_MANAGERS)(
    'a non-exact authored manager %s is refused with the version to write',
    async (manifest) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': manifest,
        });
        expect(await rejection(selectPackageInstaller(sandbox.path, []))).toContain('needs an exact pnpm version');
    },
);

test('manager selection reads linked authored declarations inside the repository and refuses external ones', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const source = '{"packageManager":"pnpm@9.1.0"}';
    await createFileTree(sandbox.path, { 'settings/manifest.json': source });
    await createFileTree(outside.path, { 'package.json': source });
    await symlink('settings/manifest.json', join(sandbox.path, 'package.json'));
    expect(await selectPackageInstaller(sandbox.path, [])).toStrictEqual({ name: 'pnpm', version: '9.1.0' });
    await unlink(join(sandbox.path, 'package.json'));
    await symlink(join(outside.path, 'package.json'), join(sandbox.path, 'package.json'));
    expect(await rejection(selectPackageInstaller(sandbox.path, []))).toContain('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe(source);
});
