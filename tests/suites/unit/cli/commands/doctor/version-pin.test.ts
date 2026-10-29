import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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

test.each(['missing', 'matching', 'different'])('doctor prints the %s version pin', async (state) => {
    const pin = state === 'matching' ? cliPackage.version : '9.9.9';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        ...(state === 'missing' ? {} : { '.gspot/version': `${pin}\n` }),
    });
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.stderr).toBe('');
    if (state === 'missing') expect(result.stdout).toContain(`gspot      ${cliPackage.version} running, no pin`);
    else if (state === 'matching')
        expect(result.stdout).toContain(`gspot      ${cliPackage.version} pinned and running`);
    else
        expect(result.stdout).toContain(
            `gspot      9.9.9 pinned and running ${cliPackage.version}\nInstall the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9`,
        );
});
