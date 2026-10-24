import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import { installNpmTools, prepareNpmLockfile, assertPackageManagerVersion } from '#cli/install/npm/project.ts';

import {
    FAILED_INSTALL_CASES,
    PACKAGE_MANAGER_TIMEOUT,
    PACKAGE_MANAGER_AGE_CASES,
} from '#tests/config/install/npm/project.ts';

test('the npm fallback for Yarn 1 refuses npm without the release age guard', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    const run = processes.spawnProcessBlocking;
    using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'npm' ? buildProcessResult({ stdout: '11.18.0\n' }) : run(command, options),
    );
    using _npm = fakeCommand('npm', () => Promise.resolve(buildProcessResult({ stdout: '11.18.0\n' })));
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    expect(await captureRejection(assertPackageManagerVersion(buildToolInstall(session, owner)))).toBe(
        'gspot install needs npm 11.19.0 or later, which holds back new releases for dependencies.min_release_age_days. Found 11.18.0.',
    );
});

test.each(PACKAGE_MANAGER_AGE_CASES)(
    'release age support for $name $version is $accepted',
    async ({ name, version, minimum, accepted }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `${name}@${version}` }),
        });
        using _manager = fakeCommand(name, () => Promise.resolve(buildProcessResult({ stdout: `${version}\n` })));
        const session = await openSession(sandbox.path);
        using owner = openWriter(sandbox.path);
        const context = buildToolInstall(session, owner);
        const checked = assertPackageManagerVersion(context);
        if (accepted) await checked;
        else
            expect(await captureRejection(checked)).toBe(
                `gspot install needs ${name} ${minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${version}.`,
            );
        expect(context.steps).toStrictEqual([[name, '--version']]);
    },
);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function fakeFailingBun(failure: Partial<Pick<SpawnResult, 'stdout' | 'stderr' | 'timedOut'>>): Disposable {
    return fakeCommand('bun', (command) =>
        Promise.resolve(
            buildProcessResult(command[1] === '--version' ? { stdout: '1.4.2\n' } : { code: 1, ...failure }),
        ),
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in this file share it.
function buildNpmConfigFile(content: string): GeneratedFile {
    return { path: GSPOT_PATHS.npmProject, content };
}

test.each([...FAILED_INSTALL_CASES])(
    'a failed $operation keeps the files and hides credentials',
    async ({ frozen, operation }) => {
        const refusal = 'HTTP 403 Forbidden';
        await using sandbox = await testdir();
        const token = 'synthetic-registry-failure-token';
        const password = 'synthetic-registry-password/with spaces';
        const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
        const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
        const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
        const original = frozen
            ? packageJson
            : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: frozen ? '3.8.1' : '3.8.0' } } },
        });
        await createFileTree(sandbox.path, {
            '.npmrc': source,
            'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
            [GSPOT_PATHS.npmProject]: original,
            [`${DOT_GSPOT}/bun.lock`]: lockfile,
        });
        await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
        const session = await openSession(sandbox.path);
        using owner = openWriter(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            fakeFailingBun({
                stdout: `Downloading ${registry}private-check-tool\n${password}\n${token}`,
                stderr: `${refusal} from ${registry}private-check-tool`,
            }),
        );
        const installationError = await (
            frozen
                ? installNpmTools(buildToolInstall(session, owner))
                : prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined)
        ).catch((error: unknown) => error);
        expect(installationError).toBeInstanceOf(Error);
        expect(installationError).toMatchObject({
            name: 'GspotError',
            code: 'install',
            message: `bun ${operation} failed (exit 1).\nDownloading https://[redacted]@registry.example.com/private-check-tool\n[redacted]\n[redacted]\n${refusal} from https://[redacted]@registry.example.com/private-check-tool`,
        });
        expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(original);
        expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
    },
);

test('an npm install that runs past the time limit names the limit', async () => {
    await using sandbox = await testdir();
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: packageJson,
        [`${DOT_GSPOT}/bun.lock`]: JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.1' } } } }),
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using _bun = fakeFailingBun({ timedOut: true });
    expect(await captureRejection(installNpmTools(buildToolInstall(session, owner)))).toBe(
        `The command bun install --frozen-lockfile --linker hoisted ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
});

test.each([false, true])('credentials in a lockfile are refused (frozen install: %p)', async (frozen) => {
    await using sandbox = await testdir();
    const token = 'synthetic-generated-lockfile-token';
    const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
    const packageJson = JSON.stringify({ private: true, devDependencies: { prettier: '3.8.1' } });
    const credentialLockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${token}`, {}, 'integrity'] },
    });
    const original = frozen ? packageJson : JSON.stringify({ private: true, devDependencies: { prettier: '3.8.0' } });
    const lockfile = frozen
        ? credentialLockfile
        : JSON.stringify({ workspaces: { '': { devDependencies: { prettier: '3.8.0' } } } });
    await createFileTree(sandbox.path, {
        '.npmrc': source,
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}\n',
        [GSPOT_PATHS.npmProject]: original,
        [`${DOT_GSPOT}/bun.lock`]: lockfile,
        [`${GSPOT_PATHS.nodeModules}/authored.txt`]: 'keep installed files',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    using boundary = fakeCommand('bun', async (command, options) => {
        if (!frozen && command[1] !== '--version') await writeFile(join(options.cwd, 'bun.lock'), credentialLockfile);
        return buildProcessResult({ stdout: command[1] === '--version' ? '1.4.2\n' : '' });
    });
    const message = await captureRejection(
        prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined),
    );
    expect(message).toBe(
        frozen
            ? 'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.'
            : 'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(original);
    expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
    expect(await readFile(join(sandbox.path, `${GSPOT_PATHS.nodeModules}/authored.txt`), 'utf8')).toBe(
        'keep installed files',
    );
    if (frozen) expect(boundary).not.toHaveBeenCalled();
    else expect(boundary).toHaveBeenCalled();
});

test('a missing Node stops npm before it writes a lockfile and keeps a cached lockfile', async () => {
    const packageJson = JSON.stringify({
        ...NPM_TOOL_PROJECT,
        devDependencies: { prettier: '3.8.1' },
    });
    const lockfile = JSON.stringify({
        workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        packages: { prettier: ['prettier@3.8.1', '', {}, 'sha512-YQ=='] },
    });
    await using sandbox = await testdir({ 'package.json': '{"private":true,"packageManager":"bun@1.4.2"}' });
    await createFileTree(sandbox.path, { 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using _path = overrideEnvironment({
        PATH: join(sandbox.path, 'missing-bin'),
        MISE_DATA_DIR: join(sandbox.path, 'missing-mise'),
    });
    using owner = openWriter(sandbox.path);
    const message = await captureRejection(
        prepareNpmLockfile(buildToolInstall(session, owner), buildNpmConfigFile(packageJson), undefined),
    );
    expect(message).toBe('The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.npmProject))).toBe(false);
    await createFileTree(sandbox.path, { [GSPOT_PATHS.npmProject]: packageJson, [`${DOT_GSPOT}/bun.lock`]: lockfile });
    const cached = await prepareNpmLockfile(
        buildToolInstall(session, owner),
        buildNpmConfigFile(packageJson),
        undefined,
    );
    expect(cached.content).toBe(lockfile);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(packageJson);
    expect(await readFile(join(sandbox.path, `${DOT_GSPOT}/bun.lock`), 'utf8')).toBe(lockfile);
});
test('a package manager version timeout names the install command and configured limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    using owner = openWriter(sandbox.path);
    const context = buildToolInstall(session, owner);
    using _bun = fakeCommand('bun', () => Promise.resolve(buildProcessResult(PACKAGE_MANAGER_TIMEOUT)));
    expect(await captureRejection(assertPackageManagerVersion(context))).toBe(
        `The command bun --version ran longer than tool_timeout_seconds (${String(session.timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
    );
    expect(context.steps).toStrictEqual([['bun', '--version']]);
});
