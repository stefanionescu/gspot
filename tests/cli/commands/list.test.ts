import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/list.ts';

test('list shows selected policy states, detected configurations, and setting values without writing', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash', 'nextjs'], {
        tables: '[[ignore]]\ncheck = "bash/syntax"\nreason = "Review this separately."\n',
    });
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const listed = await runGspot(directory.path, ['list', 'configurations', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as ConfigurationsListJson;
    const checks = result.selectedConfigurations.flatMap((configuration) => configuration.checks);
    expect(checks).toContainEqual({ name: 'bash/shellcheck', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'bash/syntax', scope: '', state: 'off (ignore)' });
    expect(checks).toContainEqual({ name: 'bash/shfmt', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'structure/prefix-collisions', scope: '', state: 'off (level)' });
    expect(checks).toContainEqual({ name: 'nextjs/build', scope: '', state: 'waits for tools.next.build_on_push' });
    expect(result.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
    expect(result.available.some((configuration) => configuration.name === 'python')).toBe(true);
    const defaults = await runGspot(directory.path, ['list', '--json']);
    expect(defaults.code, defaults.stdout + defaults.stderr).toBe(0);
    expect(JSON.parse(defaults.stdout)).toStrictEqual(result);
    const settings = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    const rows = (JSON.parse(settings.stdout) as SettingsListJson).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await runGspot(directory.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    const obsolete = await runGspot(directory.path, ['doctor', '--settings']);
    expect(obsolete.code).toBe(2);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});
