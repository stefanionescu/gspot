import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { createGitSandbox } from '#tests/setup/system/git.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('doctor reports a different saved version pin and exits one', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/version': '9.9.9\n',
    });
    const diagnosed = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(1);
    expect((JSON.parse(diagnosed.stdout) as DoctorReport).version).toStrictEqual({
        running: cliPackage.version,
        pin: '9.9.9',
        installCommand: 'mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
    });
});
