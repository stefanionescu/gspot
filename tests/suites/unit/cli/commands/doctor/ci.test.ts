import { expect, test } from 'bun:test';

import { doctorOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const GITHUB_CI = 'off; gspot set ci.enabled true writes the check workflow';
const GITLAB_CI = 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow';

test.each([
    {
        name: 'a GitHub workflow before a GitLab remote',
        tracked: ['.github/workflows/build.yml'],
        remote: 'git@gitlab.com:example/repo.git',
        ci: GITHUB_CI,
    },
    {
        name: 'tracked GitLab before GitHub',
        tracked: ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        remote: 'git@github.com:example/repo.git',
        ci: GITLAB_CI,
    },
    {
        name: 'GitHub remote',
        tracked: [],
        remote: 'git@github.com:example/repo.git',
        ci: GITHUB_CI,
    },
    {
        name: 'unrecognized remote host',
        tracked: [],
        remote: 'https://github.com.example.com/example/repo.git',
        ci: 'none',
    },
])('with CI off, doctor names the commands for the CI of $name', async ({ tracked, remote, ci }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        ...Object.fromEntries(tracked.map((file) => [file, '{}\n'])),
    });
    if (tracked.length > 0) runGitStep(sandbox.path, ['add', '--', ...tracked]);
    runGitStep(sandbox.path, ['config', 'remote.origin.url', remote]);
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.stdout).toContain(`ci: ${ci}\n`);
});

test('doctor --json reports the CI provider that the settings turn on', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[ci]\nenabled = true\nprovider = "github"\n' }),
    });
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(result.stdout)).ci).toMatchObject({ enabled: true, provider: 'github' });
});

test('doctor lists a submodule', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const commit = commitAll(sandbox.path);
    const path = 'vendor/external project';
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commit},${path}`]);
    const result = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(JSON.parse(result.stdout)).toMatchObject({ submodules: [path] });
});
