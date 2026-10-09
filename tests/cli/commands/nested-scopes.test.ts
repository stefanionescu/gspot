import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import type { SettingsListJson } from '#cli/types/commands/list.ts';
import { NESTED_SCOPES_POLICY } from '#tests/config/cli/commands/nested-scopes.ts';

test('nested scopes inherit parent configurations and settings and check each file in its deepest scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': NESTED_SCOPES_POLICY,
        'api/entry.sh': 'if then\n',
        'api/worker/entry.sh': 'if then\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const settings = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(settings.code, settings.stdout + settings.stderr).toBe(0);
    const rows = (JSON.parse(settings.stdout) as SettingsListJson).settings;
    expect(rows.find((row) => row.scope === 'api/worker' && row.key === 'format.indent_width')?.value).toBe(2);
    expect(rows.find((row) => row.scope === 'api/worker' && row.key === 'limits.function_lines')?.value).toBe(30);
    const checked = await checkReport(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = checked.report.checks;
    expect(
        checks.map((check) => ({ check: check.check, scope: check.scope, fileCount: check.fileCount })),
    ).toStrictEqual([
        { check: 'bash/bash-syntax', scope: 'api', fileCount: 1 },
        { check: 'bash/bash-syntax', scope: 'api/worker', fileCount: 1 },
    ]);
    expect(new Set(checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(new Set(['api/entry.sh']));
    expect(new Set(checks[1]?.findings.map((finding) => finding.file))).toStrictEqual(new Set(['api/worker/entry.sh']));
});
