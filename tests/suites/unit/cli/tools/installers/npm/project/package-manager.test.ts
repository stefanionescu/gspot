import { expect, test } from 'bun:test';
import semver from 'semver';
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

const PNPM_MINIMUM = RELEASE_AGE_VERSIONS.pnpm;

const PNPM_MINIMUM_PATTERN = PNPM_MINIMUM.replaceAll('.', String.raw`\.`);

const PNPM_AGE_CASES = [
    { name: 'at the release age floor is accepted', version: PNPM_MINIMUM, outcome: { status: 'fulfilled' } },
    {
        name: 'below the release age floor names the pin to change',
        version: `${String(semver.major(PNPM_MINIMUM))}.0.0`,
        outcome: {
            status: 'rejected',
            reason: {
                name: 'GspotError',
                code: 'install',
                message: expect.stringMatching(
                    new RegExp(
                        String.raw`pnpm ${PNPM_MINIMUM_PATTERN} .*Change the pnpm version that package\.json pins\.$`,
                        'u',
                    ),
                ) as string,
            },
        },
    },
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
    expect(versionError.message).toContain('Found 11.18.0.');
    expect(versionError.message).toEndWith('Run npm install --global npm@latest.');
});

test.each(PNPM_AGE_CASES)('a pinned pnpm $name', async ({ version, outcome }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': JSON.stringify({ private: true, packageManager: `pnpm@${version}` }),
    });
    using _manager = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: `${version}\n` })));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const [checked] = await Promise.allSettled([assertPackageManagerVersion(install)]);
    expect(checked).toMatchObject(outcome);
});

test('a pinned pnpm that runs another major names both versions', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"pnpm@10.16.0"}',
    });
    using _manager = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: '9.15.0\n' })));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const error = await captureRejection(assertPackageManagerVersion(install));
    expect(error).toMatchObject({ name: 'GspotError', code: 'tool' });
    expect(error.message).toContain('pnpm@10.x');
    expect(error.message).toContain('found 9.15.0');
});

test('without a packageManager field, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    await using bin = await testdir();
    await writeProgramCommand(bin.path, 'npm', 'fakes/tool', '--line', '10.9.0');
    const session = await openSession(sandbox.path);
    using _environment = overrideEnvironment({ PATH: bin.path });
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
