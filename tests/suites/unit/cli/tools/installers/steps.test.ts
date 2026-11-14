import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runInstallStep, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';

test.skipIf(isWindows)('an install step that a signal stops names the signal in place of an exit code', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const command = buildProgramCommand('fakes/tool', '--signal', 'SIGKILL');
    const error = await captureRejection(
        runRequiredInstallStep(install, command, { cwd: sandbox.path, step: 'installing', name: 'npm installation' }),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('SIGKILL');
});

test('an install step past tool_timeout_seconds stops and names the setting', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: 'tool_timeout_seconds = 1\n' }),
    });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    using _slow = fakeCommands('slow-tool', () => Promise.resolve(buildProcessResult({ end: 'timed-out', code: 1 })));
    const error = await captureRejection(runInstallStep(install, ['slow-tool'], { cwd: sandbox.path }));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('(1s)');
    expect(error.message).toContain('gspot set tool_timeout_seconds');
});
