import { join } from 'node:path';
import * as filesystem from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/public.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { prepareToolProject } from '#cli/tools/contracts.ts';
import { YARN_MANAGERS } from '#tests/config/samples/npm.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import { fakeCommand, prepareTestCommand } from '#tests/harness/command.ts';
import { githubRefusalNote, runPackageInstaller, packageInstallerCommands } from '#cli/tools/npm/contracts.ts';
import { packageToolProject, selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/public.ts';

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
        expect(packageInstallerCommands(installer).lockfile).toStrictEqual(lockfile);
        expect(packageInstallerCommands(installer).install).toStrictEqual(install);
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
        const command = packageInstallerCommands(installer);
        const failure = await runPackageInstaller(
            repository.path,
            isolated.path,
            installer,
            operation === 'lockfile' ? command.lockfile : command.install,
            operation === 'lockfile' ? 'lockfile resolution failed' : 'immutable installation failed',
        ).catch((error: unknown) => error);
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
        const installer: PackageInstaller = { name: 'bun', version: '1.4.2' };
        const command = packageInstallerCommands(installer);
        const failure = runPackageInstaller(
            repository.path,
            isolated.path,
            installer,
            frozen ? command.install : command.lockfile,
            frozen ? 'immutable installation failed' : 'lockfile resolution failed',
        );
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
        const installer: PackageInstaller = { name: 'bun', version: '1.4.2' };
        const command = packageInstallerCommands(installer);
        const diagnostic = await rejection(
            runPackageInstaller(
                repository.path,
                isolated.path,
                installer,
                frozen ? command.install : command.lockfile,
                frozen ? 'immutable installation failed' : 'lockfile resolution failed',
            ),
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

test('missing Node refuses npm lockfile resolution before scratch creation and preserves a cached lockfile', async () => {
    const manifest = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        packageManager: 'bun@1.4.2',
        devDependencies: { prettier: '3.8.1' },
    });
    const lockfile = JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } });
    await using sandbox = await testdir({ 'source.txt': 'kept\n' });
    using _path = useEnvironment({ PATH: join(sandbox.path, 'missing-bin') });
    using _home = spyOn(spawn, 'miseHome').mockReturnValue(join(sandbox.path, 'missing-mise'));
    using _scratch = spyOn(filesystem, 'mkdtempSync').mockImplementation(() => {
        throw new Error('Scratch creation preceded the missing Node diagnostic.');
    });
    let invoked = false;
    const description = {
        ...packageToolProject,
        createLockfile: () => {
            invoked = true;
            return Promise.resolve('unexpected lockfile');
        },
    };
    using owner = openRoot(sandbox.path);
    const diagnostic = await rejection(
        prepareToolProject(
            description,
            { path: description.manifestPath, content: manifest, kind: 'tool_file' },
            owner,
            { refreshLockfiles: false },
            { root: sandbox.path, yarn: undefined },
        ),
    );
    expect(diagnostic).toBe('node is required by the npm tool project. Install it before resolving its lockfile.');
    expect(invoked).toBe(false);
    expect(await pathExists(join(sandbox.path, description.manifestPath))).toBe(false);
    await createFileTree(sandbox.path, { [description.manifestPath]: manifest, '.gspot/bun.lock': lockfile });
    const cached = await prepareToolProject(
        description,
        { path: description.manifestPath, content: manifest, kind: 'tool_file' },
        owner,
        { refreshLockfiles: false },
        { root: sandbox.path, yarn: undefined },
    );
    expect(cached.content).toBe(lockfile);
    expect(invoked).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, description.manifestPath), 'utf8')).toBe(manifest);
    expect(await readFile(join(sandbox.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
});
