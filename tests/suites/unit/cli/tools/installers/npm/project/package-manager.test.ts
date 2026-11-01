import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import * as processes from '#cli/system/processes.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { PACKAGE_MANAGER_AGE_CASES } from '#tests/config/tools/npm.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';

test('npm in place of Yarn 1 refuses to run without the minimum release age', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    const run = processes.spawnProcessBlocking;
    using _version = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'npm' ? buildProcessResult({ stdout: '11.18.0\n' }) : run(command, options),
    );
    using _npm = fakeCommands('npm', () => Promise.resolve(buildProcessResult({ stdout: '11.18.0\n' })));
    const session = await openSession(sandbox.path);
    const owner = openFiles(sandbox.path);
    const versionError = await captureRejection(assertPackageManagerVersion(buildToolInstall(session, owner)));
    expect(versionError.message).toBe(
        'gspot install needs npm 11.19.0 or later, which holds back new releases for dependencies.min_release_age_days. Found 11.18.0.',
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
        const owner = openFiles(sandbox.path);
        const context = buildToolInstall(session, owner);
        const checked = assertPackageManagerVersion(context);
        if (accepted) await checked;
        else {
            const checkedError = await captureRejection(checked);
            expect(checkedError.message).toBe(
                `gspot install needs ${name} ${minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${version}.`,
            );
        }
    },
);

test('a pinned pnpm runs through mise instead of the older PATH executable', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"pnpm@10.30.0"}',
    });
    const run = processes.spawnProcess;
    using _commands = spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
        if (command[0] === 'pnpm') return Promise.resolve(buildProcessResult({ stdout: '9.9.0\n' }));
        return command[0] === 'mise'
            ? Promise.resolve(buildProcessResult({ stdout: '10.30.0\n' }))
            : run(command, options);
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(session, writer);
    await assertPackageManagerVersion(install);
});
