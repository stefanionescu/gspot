import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readGitSetting } from '#cli/system/git.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/cli.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each(['', 'app/'])('install from %s points core.hooksPath at .gspot/hooks', async (prefix) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'app/gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
    });

    runGitStep(sandbox.path, ['init', '-q']);
    const root = join(sandbox.path, prefix);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stdout.split('\n')).toContain(`set core.hooksPath to ${GSPOT_PATHS.hooks}`);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
});
test('doctor reports hooks this clone has not installed and accepts them after install', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }) });

    runGitStep(sandbox.path, ['init', '-q']);
    const missing = await spawnGspot(sandbox.path, ['doctor', '--json']);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect((JSON.parse(missing.stdout) as DoctorReport).hooks).toBe('not installed; run gspot install');
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const diagnosed = await spawnGspot(sandbox.path, ['doctor', '--json']);
    expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(0);
    const report = JSON.parse(diagnosed.stdout) as DoctorReport;
    expect(report.hooks).toBe('installed');
    expect(report.tools.filter(({ state }) => state !== 'ok' && state !== 'system')).toStrictEqual([]);
});
