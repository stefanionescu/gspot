import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

const NESTED_SCOPES_POLICY = `kits = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[rules]
install = false
[[scope]]
path = "api"
kits = ["bash"]
[scope.limits]
file_lines = 200
[scope.format]
indent_width = 2
[[scope]]
path = "api/worker"
kits = ["sql"]
[scope.limits]
function_lines = 30
`;

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
    const rows = (
        JSON.parse(settings.stdout) as { settings: { key: string; scope: string; value: unknown; source: string }[] }
    ).settings;
    expect(rows.find((row) => row.scope === 'api/worker' && row.key === 'limits.file_lines')).toMatchObject({
        value: 200,
        source: '[[scope]] api',
    });
    expect(rows.find((row) => row.scope === 'api/worker' && row.key === 'format.indent_width')?.value).toBe(2);
    expect(rows.find((row) => row.scope === 'api/worker' && row.key === 'limits.function_lines')?.value).toBe(30);
    const checked = await runGspot(directory.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = (JSON.parse(checked.stdout) as RunReport).checks;
    expect(
        checks.map((check) => ({ check: check.check, scope: check.scope, fileCount: check.fileCount })),
    ).toStrictEqual([
        { check: 'bash/syntax', scope: 'api', fileCount: 1 },
        { check: 'bash/syntax', scope: 'api/worker', fileCount: 1 },
    ]);
    expect(checks[0]?.findings.map((finding) => finding.file)).toStrictEqual(['api/entry.sh', 'api/entry.sh']);
    expect(checks[1]?.findings.map((finding) => finding.file)).toStrictEqual([
        'api/worker/entry.sh',
        'api/worker/entry.sh',
    ]);
    writeFileSync(join(directory.path, 'api/entry.sh'), 'echo example\n');
    writeFileSync(join(directory.path, 'api/worker/entry.sh'), 'echo example\n');
    const corrected = await runGspot(directory.path, ['check', '--only', 'bash/syntax', 'sql/syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/syntax', scope: 'api', status: 'passed', findings: [] },
        { check: 'bash/syntax', scope: 'api/worker', status: 'passed', findings: [] },
        { check: 'sql/syntax', scope: 'api/worker', status: 'passed', findings: [] },
    ]);
});
