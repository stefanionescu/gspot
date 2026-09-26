import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { RunReport } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';

test('the selected naming configuration rejects banned terms in declarations and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript", "naming"]\n',
        'shell.js': 'export const shellCommand = 1;\n',
        'shell/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--no-cache', '--json'];
    const refused = await run(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'fail'],
        ['naming/paths', 'fail'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing({ rule: 'banned-term', file: 'shell.js', line: 1, column: 14 }),
    );
    expect(report.checks[1]!.findings).toContainEqual(containing({ rule: 'banned-term', file: 'shell.js', line: 1 }));
    renameSync(join(sandbox.path, 'shell.js'), join(sandbox.path, 'entry.js'));
    renameSync(join(sandbox.path, 'shell'), join(sandbox.path, 'app'));
    await Bun.write(join(sandbox.path, 'entry.js'), 'export const command = 1;\n');
    const accepted = await run(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(accepted.stdout)).checks).toMatchObject([
        { check: 'naming/identifiers', status: 'ok', findings: [] },
        { check: 'naming/paths', status: 'ok', findings: [] },
    ]);
});

test('ordinary service and generation names pass the naming checks in code and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript", "naming"]\n',
        'service/generate.js': 'export function generate() { return "message"; }\nexport const service = generate();\n',
    });
    const result = await run(sandbox.path, [
        'check',
        '--only',
        'naming/identifiers',
        'naming/paths',
        '--no-cache',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'ok'],
        ['naming/paths', 'ok'],
    ]);
});
