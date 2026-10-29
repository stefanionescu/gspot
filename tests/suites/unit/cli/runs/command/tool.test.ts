import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/planning/session.ts';
import { buildCheckSession } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
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

test('a check tool gets the variables that tools need and none of the inherited credentials', async () => {
    await using sandbox = await testdir();
    const kept = { LANG: 'C.UTF-8', MISE_DATA_DIR: join(sandbox.path, 'mise'), NEXT_TELEMETRY_DISABLED: '1' };
    const withheld = {
        GITHUB_TOKEN: 'github-credential',
        NPM_TOKEN: 'npm-credential',
        AWS_SECRET_ACCESS_KEY: 'cloud-credential',
        MISE_GITHUB_TOKEN: 'mise-credential',
        DEPLOY_TARGET: 'project-value',
    };
    using _environment = overrideEnvironment({ ...kept, ...withheld });
    const names = [...Object.keys(withheld), ...Object.keys(kept), 'CHECK_SETTING'];
    const { result } = await runToolProcess(buildProgramCommand('processes/environment', ...names), {
        cwd: sandbox.path,
        name: 'environment-tool',
        timeoutSeconds: 10,
        env: { CHECK_SETTING: 'given' },
    });
    expect(result.stdout).toBe(`${Object.values(kept).join('')}given`);
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
