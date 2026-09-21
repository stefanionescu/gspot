import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/harness/planted.ts';

test('list shows selected policy states, detected presets, and setting values without writing', async () => {
    await using directory = await testdir();
    const policy =
        'version = 1\npresets = ["bash", "nextjs"]\n[[ignore]]\ncheck = "bash/syntax"\nreason = "Review this separately."\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const listed = await run(directory.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as {
        installed: { name: string; checks: { name: string; scope: string; state: string }[] }[];
        detected: { name: string; command: string }[];
        available: { name: string }[];
    };
    const checks = result.installed.flatMap((preset) => preset.checks);
    expect(checks).toContainEqual({ name: 'bash/shellcheck', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'bash/syntax', scope: '', state: 'off (ignore)' });
    expect(checks).toContainEqual({ name: 'bash/shfmt', scope: '', state: 'off (level)' });
    expect(checks).toContainEqual({ name: 'nextjs/build', scope: '', state: 'waits for tools.next.build_in_gate' });
    expect(result.detected.find((preset) => preset.name === 'sql')?.command).toBe('gspot add sql');
    expect(result.available.some((preset) => preset.name === 'python')).toBe(true);
    const settings = await run(directory.path, ['list', 'settings', '--json']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    const rows = (JSON.parse(settings.stdout) as { settings: { key: string; value: unknown }[] }).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await run(directory.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    const obsolete = await run(directory.path, ['doctor', '--settings']);
    expect(obsolete.code).toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});
