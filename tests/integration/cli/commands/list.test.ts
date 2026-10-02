import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';

test('list shows selected policy states, detected kits, and setting values without writing', async () => {
    await using directory = await testdir();
    const policy = policyOf(
        ['bash', 'nextjs'],
        '[[ignore]]\ncheck = "bash/syntax"\nreason = "Review this separately."\n',
    );
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const listed = await runGspot(directory.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as {
        selectedKits: { name: string; checks: { name: string; scope: string; state: string }[] }[];
        detected: { name: string; command: string }[];
        available: { name: string }[];
    };
    const checks = result.selectedKits.flatMap((configuration) => configuration.checks);
    expect(checks).toContainEqual({ name: 'bash/shellcheck', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'bash/syntax', scope: '', state: 'off (ignore)' });
    expect(checks).toContainEqual({ name: 'bash/shfmt', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'structure/prefix-collisions', scope: '', state: 'off (level)' });
    expect(checks).toContainEqual({ name: 'nextjs/build', scope: '', state: 'waits for tools.next.build_on_push' });
    expect(result.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
    expect(result.available.some((configuration) => configuration.name === 'python')).toBe(true);
    const settings = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    const rows = (JSON.parse(settings.stdout) as { settings: { key: string; value: unknown }[] }).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await runGspot(directory.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    const obsolete = await runGspot(directory.path, ['doctor', '--settings']);
    expect(obsolete.code).toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});
