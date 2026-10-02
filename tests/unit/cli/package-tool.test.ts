// The package manager of the private tool project: an exact declaration, a recorded version, or the client on the path.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { packageTool } from '#cli/tools/packages/identity.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';

test.each([
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
        'a lockfile with the version the tool project recorded',
        { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n", '.gspot/package.json': '{"packageManager":"pnpm@9.4.0"}' },
        'pnpm@9.4.0',
    ],
])('%s names the client and its version', async (_, files, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, files);
    const { name, version } = await packageTool(sandbox.path, []);
    expect(`${name}@${version}`).toBe(expected);
});

test('a devEngines range is refused with the version to write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
    });
    expect(await rejection(packageTool(sandbox.path, []))).toContain('needs an exact pnpm version');
});

test('without a declaration or Bun on the path, the tool project uses npm at the version it reports', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir();
    await createFileTree(bin.path, { npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });
    chmodSync(join(bin.path, 'npm'), 0o755);
    const path = environmentVariables()['PATH'];
    setEnvironmentVariable('PATH', bin.path);
    try {
        expect(await packageTool(sandbox.path, [])).toStrictEqual({ name: 'npm', version: '10.9.0' });
    } finally {
        setEnvironmentVariable('PATH', path);
    }
});
