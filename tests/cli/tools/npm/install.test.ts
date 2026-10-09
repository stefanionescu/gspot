import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { YARN_MANAGERS } from '#tests/config/samples/npm.ts';
import { fakeCommand, prepareTestCommand } from '#tests/harness/command.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/public.ts';

import {
    installArgv,
    lockfileArgv,
    githubRefusalNote,
    installPackageLockfile,
    preparePackageLockfile,
} from '#cli/tools/npm/contracts.ts';
import {
    PACKAGE_FAILURES,
    OTHER_DOWNLOAD_OUTPUT,
    PACKAGE_VERSION_CASES,
    GITHUB_DOWNLOAD_FAILURES,
} from '#tests/config/cli/tools/npm/install.ts';

test.each(GITHUB_DOWNLOAD_FAILURES)('a refused GitHub download names the token to set: %s', (line) => {
    expect(githubRefusalNote(`postinstall failed\n${line}\n`)).toContain('GITHUB_TOKEN');
});

test.each(OTHER_DOWNLOAD_OUTPUT)('output without a refused GitHub download adds no token note: %s', (output) => {
    expect(githubRefusalNote(output)).toBeUndefined();
});

test.each(YARN_MANAGERS)(
    'Yarn $installer.version selects compatible generated settings and native lockfile creation',
    ({ installer, lockfile, install }) => {
        expect(lockfileArgv(installer)).toStrictEqual(lockfile);
        expect(installArgv(installer)).toStrictEqual(install);
    },
);

test.each(PACKAGE_VERSION_CASES)(
    '$source version metadata cannot bypass the native $operation executable check',
    async ({ files, operation }) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        await createFileTree(repository.path, { ...files, source: 'kept\n' });
        const project = '{"private":true,"packageManager":"bun@0.0.0","dependencies":{"prettier":"3.8.1"}}\n';
        await createFileTree(isolated.path, { 'package.json': project, 'bun.lock': 'original tool lockfile\n' });
        const identity = await selectPackageInstaller(repository.path, []);
        const installer = inspectPackageInstaller(repository.path, identity);
        expect(installer).toStrictEqual({ name: 'bun', version: '0.0.0' });
        const run = spawn.run;
        let observed: ReturnType<typeof run> | undefined;
        using boundary = spyOn(spawn, 'run').mockImplementation((argv, options) => {
            if (argv[0] === 'bun' && argv[1] !== '--version')
                throw new Error('Unexpected native package operation before version refusal.');
            const prepared = prepareTestCommand(argv, options, 'package manager version');
            observed = run(argv, prepared.options);
            return observed;
        });
        const action = operation === 'lockfile' ? preparePackageLockfile : installPackageLockfile;
        const failure = await action(repository.path, isolated.path, installer).catch((error: unknown) => error);
        expect(boundary).toHaveBeenCalledTimes(1);
        const version = await observed;
        expect(version?.code, version?.stderr).toBe(0);
        expect(version?.stdout.trim()).not.toBe('0.0.0');
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'tool',
            message: 'The tool project requires bun@0.x. Install that package manager version first.',
        });
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(repository.path, path), 'utf8')).toBe(content);
        expect(await readFile(join(repository.path, 'source'), 'utf8')).toBe('kept\n');
        expect(await readFile(join(isolated.path, 'package.json'), 'utf8')).toBe(project);
        expect(await readFile(join(isolated.path, 'bun.lock'), 'utf8')).toBe('original tool lockfile\n');
        expect(await pathExists(join(isolated.path, 'node_modules'))).toBe(false);
    },
);

test.each(PACKAGE_FAILURES)(
    'a package failure preserves files and redacts $refusal with frozen=$frozen',
    async ({ frozen, refusal }) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        const token = 'synthetic-registry-failure-token';
        const password = 'synthetic-registry-password/with spaces';
        const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
        const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        await createFileTree(isolated.path, {
            'package.json': '{"private":true}\n',
            'bun.lock': 'original lockfile\n',
        });
        using _installer = fakeCommand('bun', (command) => {
            const version = command[1] === '--version';
            return Promise.resolve({
                code: version ? 0 : 1,
                missing: false,
                duration: 0,
                stdout: version
                    ? '1.4.2\n'
                    : `Downloading https://api.github.com/repos/example/tool/releases\nDownloading ${registry}private-check-tool\n${password}\n${token}`,
                stderr: version ? '' : `${refusal} from ${registry}private-check-tool`,
            });
        });
        const failure = (frozen ? installPackageLockfile : preparePackageLockfile)(repository.path, isolated.path, {
            name: 'bun',
            version: '1.4.2',
        });
        const diagnosticError = await failure.catch((error: unknown) => error);
        expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
        const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
        expect(diagnostic).toContain(
            `bun ${frozen ? 'immutable installation' : 'lockfile resolution'} failed (exit 1)`,
        );
        expect(diagnostic).toContain(refusal);
        expect(diagnostic).not.toContain('GITHUB_TOKEN');
        expect(diagnostic).toContain('Run: gspot apply, then gspot install');
        for (const credential of [token, password, encodeURIComponent(password)])
            expect(diagnostic).not.toContain(credential);
        expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(isolated.path, 'bun.lock'), 'utf8')).toBe('original lockfile\n');
    },
);

test.each([false, true])(
    'a successful native %s operation refuses credentials in its prepared lockfile',
    async (frozen) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        const token = 'synthetic-generated-lockfile-token';
        const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        await createFileTree(isolated.path, { 'package.json': '{"private":true}\n', 'bun.lock': token });
        using boundary = fakeCommand('bun', (command) => {
            return Promise.resolve({
                code: 0,
                missing: false,
                duration: 0,
                stdout: command[1] === '--version' ? '1.4.2\n' : '',
                stderr: '',
            });
        });
        const diagnostic = await rejection(
            (frozen ? installPackageLockfile : preparePackageLockfile)(repository.path, isolated.path, {
                name: 'bun',
                version: '1.4.2',
            }),
        );
        expect(diagnostic).toBe(
            'The package manager included registry credentials in its lockfile. Existing files were preserved.',
        );
        expect(diagnostic).not.toContain(token);
        expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(isolated.path, 'bun.lock'), 'utf8')).toBe(token);
        expect(boundary).toHaveBeenCalled();
    },
);
