import { expect, test } from 'bun:test';

import { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';
import { PACKAGE_MANAGER_AGE_CASES } from '#tests/config/tools/npm.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test.each([
    {
        name: 'npm in place of Yarn 1',
        manager: 'npm',
        files: { 'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}' },
        found: '11.18.0',
        fix: 'Run npm install --global npm@latest.',
    },
] as const)('$name below the release age floor names its upgrade command', async ({ manager, files, found, fix }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), ...files });
    using _manager = fakeCommands(manager, () => Promise.resolve(buildProcessResult({ stdout: `${found}\n` })));
    const session = await openSession(sandbox.path);
    const owner = openFiles(sandbox.path);
    const versionError = await captureRejection(
        assertPackageManagerVersion(await buildSandboxToolInstall(session, owner)),
    );
    expect(versionError).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(versionError.message).toBe(
        `gspot needs ${manager} ${RELEASE_AGE_VERSIONS[manager]} or later, which holds back new releases for dependencies.min_release_age_days. Found ${found}. ${fix}`,
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
        const context = await buildSandboxToolInstall(session, owner);
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
