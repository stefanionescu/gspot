import { expect, spyOn, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import * as processes from '#cli/system/processes.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';
import { PACKAGE_MANAGER_AGE_CASES } from '#tests/config/tools/npm.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('npm in place of Yarn 1 refuses to run without the minimum release age', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    using _npm = fakeCommands('npm', () => Promise.resolve(buildProcessResult({ stdout: '11.18.0\n' })));
    const session = await openSession(sandbox.path);
    const owner = openFiles(sandbox.path);
    const versionError = await captureRejection(
        assertPackageManagerVersion(await buildSandboxToolInstall(session, owner)),
    );
    expect(versionError).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(versionError.message).toContain('npm 11.19.0');
    expect(versionError.message).toContain('11.18.0');
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
        const context = await buildSandboxToolInstall(session, owner);
        const checked = assertPackageManagerVersion(context);
        if (accepted) await checked;
        else {
            const checkedError = await captureRejection(checked);
            expect(checkedError).toMatchObject({ name: 'GspotError', code: 'install' });
            expect(checkedError.message).toContain(`${name} ${minimum}`);
            expect(checkedError.message).toContain(version);
        }
    },
);

test('a pinned pnpm runs through mise instead of the older PATH executable', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"pnpm@10.30.0"}',
    });
    const run = processes.runProcess;
    using commands = spyOn(processes, 'runProcess').mockImplementation((command, options) => {
        if (command[0] === 'pnpm') return Promise.resolve(buildProcessResult({ stdout: '9.9.0\n' }));
        return command[0] === 'mise'
            ? Promise.resolve(buildProcessResult({ stdout: '10.30.0\n' }))
            : run(command, options);
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    await assertPackageManagerVersion(install);
    const programs = commands.mock.calls.map(([command]) => command[0]);
    expect(programs).toContain('mise');
    expect(programs).not.toContain('pnpm');
});
