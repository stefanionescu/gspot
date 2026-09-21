import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/harness/planted.ts';

const POLICY = `version = 1
presets = ["formatting"]
[limits]
file_lines = 250
[format]
indent_width = 4
[rules]
install = false
[[scope]]
path = "api"
presets = ["bash"]
[scope.limits]
file_lines = 200
[scope.format]
indent_width = 2
[[scope]]
path = "api/worker"
presets = ["sql"]
[scope.limits]
function_lines = 30
`;

test('nested scopes inherit parent presets and settings and check each file in its deepest scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': POLICY,
        'api/entry.sh': 'if then\n',
        'api/worker/entry.sh': 'if then\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const settings = await run(directory.path, ['list', 'settings', '--json']);
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
    const checked = await run(directory.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = (
        JSON.parse(checked.stdout) as {
            checks: { check: string; scope: string; files: number; findings: { file: string }[] }[];
        }
    ).checks;
    expect(checks.map((check) => ({ check: check.check, scope: check.scope, files: check.files }))).toEqual([
        { check: 'bash/syntax', scope: 'api', files: 1 },
        { check: 'bash/syntax', scope: 'api/worker', files: 1 },
    ]);
    expect(checks[0]?.findings.map((finding) => finding.file)).toEqual(['api/entry.sh', 'api/entry.sh']);
    expect(checks[1]?.findings.map((finding) => finding.file)).toEqual(['api/worker/entry.sh', 'api/worker/entry.sh']);
    writeFileSync(join(directory.path, 'api/entry.sh'), 'echo example\n');
    writeFileSync(join(directory.path, 'api/worker/entry.sh'), 'echo example\n');
    const corrected = await run(directory.path, [
        'check',
        '--only',
        'bash/syntax',
        'sql/syntax',
        '--no-cache',
        '--json',
    ]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
