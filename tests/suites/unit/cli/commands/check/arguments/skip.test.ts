import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('--skip repeats, takes commas, and leaves the paths after it as paths', async () => {
    const ids = ['sandbox/one', 'sandbox/two', 'sandbox/three', 'sandbox/kept'];
    const checks = ids.map((id) => buildReportingCheck({ id, paths: ['*.ts'], stage: 'commit' }));
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'selected.ts': 'selected',
        'other.ts': 'other',
    });
    const { report } = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--skip',
            'sandbox/one,sandbox/two',
            'selected.ts',
            '--skip',
            'sandbox/three',
            '--json',
        ]),
    );
    const kept = report.checks.filter(({ check }) => ids.includes(check));
    expect(kept.map(({ check }) => check)).toStrictEqual(['sandbox/kept']);
    expect(kept[0]?.findings.map(({ message }) => message)).toStrictEqual(['selected.ts']);
});

test('a selection that --skip empties exits 2', async () => {
    const checks = [
        buildReportingCheck({ id: 'sandbox/commit', paths: ['*.ts'], stage: 'commit' }),
        buildReportingCheck({ id: 'sandbox/push', paths: ['*.ts'], stage: 'push' }),
    ];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'selected.ts': 'selected',
    });
    const flags = ['--only', 'sandbox/commit', '--skip', 'sandbox/commit'];
    const refused = await runGspot(sandbox.path, ['check', ...flags]);
    expect(refused).toStrictEqual({
        code: 2,
        stdout: '',
        stderr: '--skip leaves out every check that --only names: sandbox/commit. Change --only or --skip.\n',
    });
    const partial = await runGspot(sandbox.path, ['check', ...flags, '--only', 'sandbox/push']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(1);
});
