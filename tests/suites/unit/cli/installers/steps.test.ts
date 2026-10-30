import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { runRequiredInstallStep } from '#cli/installers/steps.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a required install failure records its command and redacts URL credentials', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const writer = openFiles(sandbox.path);
    const install = buildToolInstall(await openSession(sandbox.path), writer);
    const command = buildProgramCommand(
        'fakes/tool',
        '--exit',
        '3',
        '--stderr',
        'https://alex:secret@example.com/file',
    );
    const error = await captureRejection(
        runRequiredInstallStep(install, command, { cwd: sandbox.path, name: 'Example' }),
    );
    expect(error).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message: 'Example failed (exit 3):\nhttps://[redacted]@example.com/file',
    });
    expect(install.steps).toStrictEqual([command]);
});
