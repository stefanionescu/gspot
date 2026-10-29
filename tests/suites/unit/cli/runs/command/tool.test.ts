import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/planning/session.ts';
import { buildCheckSession } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runToolProcess, buildOtherToolEnvironment } from '#cli/runs/command/tool.ts';

test('a timed-out tool carries the configured time limit in its failure', async () => {
    await using sandbox = await testdir();
    const { failure } = await runToolProcess(buildProgramCommand('fakes/tool', '--wait'), {
        cwd: sandbox.path,
        name: 'waiting-tool',
        timeoutSeconds: 0.2,
    });
    expect(failure).toStrictEqual({
        status: 'error',
        note: 'waiting-tool ran longer than tool_timeout_seconds (0.2s), so gspot stopped it.',
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
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const session = buildCheckSession(await openSession(sandbox.path));
    using _executables = fakeExecutableLookup((name) => (name === 'mise' ? null : join(sandbox.path, name, name)));
    const environment = buildOtherToolEnvironment(session, ['first-companion', 'second-companion'], {
        PATH: 'original-search-path',
    });
    expect(environment['PATH']).toBe(
        [join(sandbox.path, 'first-companion'), join(sandbox.path, 'second-companion'), 'original-search-path'].join(
            delimiter,
        ),
    );
});
