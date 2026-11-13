import { delimiter, join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildCheckSession } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildSecondaryToolEnvironment, runToolProcess } from '#cli/engine/tool-runs/tool.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a timed-out tool reports the configured time limit and the last output of the tool', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess(buildProgramCommand('fakes/tool', '--line', 'running test 3', '--wait'), {
        cwd: sandbox.path,
        name: 'waiting-tool',
        timeoutSeconds: 0.5,
    });
    expect(failure).toStrictEqual({ status: 'error', note: expect.stringContaining('0.5s') as string });
    expect(failure?.note).toEndWith('\nrunning test 3');
});

test('a missing executable is reported as missing rather than a check finding', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess([join(sandbox.path, 'absent-program')], {
        cwd: sandbox.path,
        name: 'absent-tool',
        timeoutSeconds: 1,
    });
    expect(failure?.status).toBe('missing');
    expect(failure?.note).toContain('absent-tool');
});

test('companion tool folders precede the existing PATH in declared order', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    using _executables = fakeExecutableLookup((name) => (name === 'mise' ? null : join(sandbox.path, name, name)));
    const environment = await buildSecondaryToolEnvironment(session, ['zsh', 'openssl'], {
        PATH: 'original-search-path',
    });
    expect(environment['PATH']).toBe(
        [join(sandbox.path, 'zsh'), join(sandbox.path, 'openssl'), 'original-search-path'].join(delimiter),
    );
});
