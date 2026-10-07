// The package manager is inspected only when the isolated tool project needs an exact version.
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { installPackageLock, preparePackageLock } from '#cli/tools/npm/install.ts';
import { chmodSync, existsSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';
import { prepareTestCommand, runTestCommandBlocking } from '#tests/harness/command.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/client.ts';
import { NON_EXACT_MANAGERS, PACKAGE_SELECTIONS, PACKAGE_VERSION_CASES } from '#tests/config/cli/tools/npm/client.ts';

test('without a declaration or Bun on the path, the tool project uses npm at the version it reports', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir();
    await createFileTree(bin.path, { npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });
    chmodSync(join(bin.path, 'npm'), 0o755);
    const path = environmentVariables()['PATH'];
    setEnvironmentVariable('PATH', bin.path);
    try {
        const installer = await selectPackageInstaller(sandbox.path, []);
        expect(installer).toStrictEqual({ name: 'npm' });
        expect(inspectPackageInstaller(sandbox.path, installer)).toStrictEqual({ name: 'npm', version: '10.9.0' });
    } finally {
        setEnvironmentVariable('PATH', path);
    }
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
    symlinkSync('settings/manifest.json', join(sandbox.path, 'package.json'));
    expect(await selectPackageInstaller(sandbox.path, [])).toStrictEqual({ name: 'pnpm', version: '9.1.0' });
    unlinkSync(join(sandbox.path, 'package.json'));
    symlinkSync(join(outside.path, 'package.json'), join(sandbox.path, 'package.json'));
    expect(await rejection(selectPackageInstaller(sandbox.path, []))).toContain('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe(source);
});

test.each(PACKAGE_VERSION_CASES)(
    '$source version metadata cannot bypass the native $operation executable check',
    async ({ files, operation }) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        await createFileTree(repository.path, { ...files, source: 'kept\n' });
        const project = '{"private":true,"packageManager":"bun@0.0.0","dependencies":{"prettier":"3.8.1"}}\n';
        await createFileTree(isolated.path, { 'package.json': project, 'bun.lock': 'original tool lock\n' });
        const observed = runTestCommandBlocking(['bun', '--version'], { cwd: repository.path });
        expect(observed.code, observed.stderr).toBe(0);
        expect(observed.stdout.trim()).not.toBe('0.0.0');
        const identity = await selectPackageInstaller(repository.path, []);
        const installer = inspectPackageInstaller(repository.path, identity);
        expect(installer).toStrictEqual({ name: 'bun', version: '0.0.0' });
        const run = spawn.run;
        using boundaries = new DisposableStack();
        boundaries.use(
            spyOn(spawn, 'run').mockImplementation((argv, options) => {
                if (argv[0] === 'bun' && argv[1] !== '--version')
                    throw new Error('Unexpected native package operation before version refusal.');
                const prepared = prepareTestCommand(argv, options, 'package manager version');
                return run(argv, prepared.options);
            }),
        );
        const action = operation === 'lock' ? preparePackageLock : installPackageLock;
        const failure = await action(repository.path, isolated.path, installer).catch((error: unknown) => error);
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'tool',
            message: 'The tool project requires bun@0.0.0. Install that package manager version first.',
        });
        for (const [path, content] of Object.entries(files))
            expect(readFileSync(join(repository.path, path), 'utf8')).toBe(content);
        expect(readFileSync(join(repository.path, 'source'), 'utf8')).toBe('kept\n');
        expect(readFileSync(join(isolated.path, 'package.json'), 'utf8')).toBe(project);
        expect(readFileSync(join(isolated.path, 'bun.lock'), 'utf8')).toBe('original tool lock\n');
        expect(existsSync(join(isolated.path, 'node_modules'))).toBe(false);
    },
);
