import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import { openSession } from '#cli/engine/session.ts';
import { assertPackageManagerVersion, readToolPackageManager } from '#cli/tools/installers/npm/project.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeCommands, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const PACKAGE_MANAGER_AGE_CASES = [
    { name: 'pnpm', version: '10.15.0', minimum: '10.16.0', accepted: false },
    { name: 'pnpm', version: '10.16.0', minimum: '10.16.0', accepted: true },
];

test('npm in place of Yarn 1 below the release age floor names its upgrade command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    using _manager = fakeCommands('npm', () => Promise.resolve(buildProcessResult({ stdout: '11.18.0\n' })));
    const session = await openSession(sandbox.path);
    const versionError = await captureRejection(assertPackageManagerVersion(await buildSandboxToolInstall(session)));
    expect(versionError).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(versionError.message).toBe(
        `gspot needs npm ${RELEASE_AGE_VERSIONS.npm} or later, which holds back new releases for dependencies.min_release_age_days. Found 11.18.0. Run npm install --global npm@latest.`,
    );
});

test.each(PACKAGE_MANAGER_AGE_CASES)(
    'release age support for $name $version is $accepted',
    async ({ name, version, minimum, accepted }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `${name}@${version}` }),
        });
        using _manager = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: `${version}\n` })));
        const session = await openSession(sandbox.path);
        const context = await buildSandboxToolInstall(session);
        const checked = assertPackageManagerVersion(context);
        if (accepted) await checked;
        else {
            const checkedError = await captureRejection(checked);
            expect(checkedError).toMatchObject({ name: 'GspotError', code: 'install' });
            expect(checkedError.message).toContain(`${name} ${minimum}`);
            expect(checkedError.message).toContain(version);
            expect(checkedError.message).toContain(`Change the ${name} version that package.json pins.`);
        }
    },
);

test('without a packageManager field or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    await using bin = await testdir();
    await writeProgramCommand(bin.path, 'npm', 'fakes/tool', '--line', '10.9.0');
    const session = await openSession(sandbox.path);
    using _environment = overrideEnvironment({ PATH: bin.path });
    expect(session.packageManager).toStrictEqual({ name: 'npm' });
    expect(await readToolPackageManager(session)).toStrictEqual({
        name: 'npm',
        version: '10.9.0',
        command: { name: 'npm' },
    });
});

test('Yarn uses npm without querying Yarn', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    const session = await openSession(sandbox.path);
    using run = fakeCommands(undefined, () => Promise.resolve(buildProcessResult({ stdout: '11.19.0\n' })));
    expect(await readToolPackageManager(session)).toStrictEqual({
        name: 'npm',
        version: '11.19.0',
        command: { name: 'npm' },
    });
    expect(run.mock.calls.map(([command]) => command)).toStrictEqual([['npm', '--version']]);
});

test('a package manager version that does not parse is an install error', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    using _manager = fakeCommands('npm', () => Promise.resolve(buildProcessResult({ stdout: 'not a version\n' })));
    const error = await captureRejection(readToolPackageManager(session));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toBe(
        'Cannot read the npm version for the tool project. Check that npm --version prints a version.',
    );
});
