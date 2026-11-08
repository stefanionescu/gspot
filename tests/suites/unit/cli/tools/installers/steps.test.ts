import { expect, spyOn, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { explainReleaseAgeHold, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const ESLINT_RELEASE = {
    label: 'eslint@10.13.0',
    kind: 'npm',
    version: '10.13.0',
    url: 'https://registry.example.com/eslint',
} as const;

const HOLD_ADVICE =
    'eslint@10.13.0 came out less than 7 days ago. The setting dependencies.min_release_age_days holds back each release for 7 days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n';

test.each([
    { name: 'a release inside the hold', status: 200, published: { '10.13.0': new Date() }, expected: HOLD_ADVICE },
    { name: 'a release older than the hold', status: 200, published: { '10.13.0': new Date(0) }, expected: '' },
    { name: 'a failed lookup', status: 500, published: {}, expected: '' },
    {
        name: 'a registry without the package',
        status: 404,
        published: {},
        expected: 'The registry has no release eslint@10.13.0.\n',
    },
    {
        name: 'a package without the release',
        status: 200,
        published: { '1.0.0': new Date(0) },
        expected: 'The registry has no release eslint@10.13.0.\n',
    },
])('$name gives its explanation', async ({ status, published, expected }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _registry = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(Response.json({ time: published }, { status })), {
            preconnect: fetch.preconnect,
        }),
    );
    const output = 'npm error notarget No matching version found for eslint@10.13.0 with a date before 10/23/2026.';
    const prettier = { ...ESLINT_RELEASE, label: 'prettier@3.8.1' };
    expect(await explainReleaseAgeHold(install, output, [ESLINT_RELEASE, prettier])).toBe(expected);
});

test.skipIf(isWindows)('an install step that a signal stops names the signal in place of an exit code', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const command = buildProgramCommand('fakes/tool', '--signal', 'SIGKILL');
    const error = await captureRejection(
        runRequiredInstallStep(install, command, { cwd: sandbox.path, step: 'installing', name: 'npm installation' }),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('SIGKILL');
});
