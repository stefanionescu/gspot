import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/engine/session.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runToolProcess, buildSecondaryToolEnvironment } from '#cli/engine/tool-runs/tool.ts';

test('a timed-out tool carries the configured time limit in its failure', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess(buildProgramCommand('fakes/tool', '--wait'), {
        cwd: sandbox.path,
        name: 'waiting-tool',
        timeoutSeconds: 0.2,
    });
    expect(failure).toStrictEqual({
        status: 'error',
        note: 'waiting-tool ran longer than tool_timeout_seconds (0.2s), so gspot stopped it. Raise the limit with gspot set tool_timeout_seconds <seconds>.',
    });
});

test('a missing executable is reported as missing rather than a check finding', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess([join(sandbox.path, 'absent-program')], {
        cwd: sandbox.path,
        name: 'absent-tool',
        timeoutSeconds: 1,
    });
    expect(failure?.status).toBe('missing');
    expect(failure?.note).toStartWith('gspot could not start absent-tool:');
});

test('companion tool folders precede the existing PATH in declared order', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    using _executables = fakeExecutableLookup((name) => (name === 'mise' ? null : join(sandbox.path, name, name)));
    const environment = await buildSecondaryToolEnvironment(session, ['first-companion', 'second-companion'], {
        PATH: 'original-search-path',
    });
    expect(environment['PATH']).toBe(
        [join(sandbox.path, 'first-companion'), join(sandbox.path, 'second-companion'), 'original-search-path'].join(
            delimiter,
        ),
    );
});

test('a timeout note holds the last output of the tool', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess(buildProgramCommand('fakes/tool', '--line', 'running test 3', '--wait'), {
        cwd: sandbox.path,
        name: 'waiting-tool',
        timeoutSeconds: 0.5,
    });
    expect(failure?.note).toEndWith('\nrunning test 3');
});
