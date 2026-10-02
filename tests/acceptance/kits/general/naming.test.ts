import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('the selected naming configuration rejects banned terms in declarations and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['javascript', 'naming'], '', 'all'),
        'helper.js': 'export const helperCommand = 1;\n',
        'helper/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--json'];
    const refused = await run(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'fail'],
        ['naming/paths', 'fail'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing({ rule: 'banned-term', file: 'helper.js', line: 1, column: 14 }),
    );
    expect(report.checks[1]!.findings).toContainEqual(containing({ rule: 'banned-term', file: 'helper.js', line: 1 }));
    renameSync(join(sandbox.path, 'helper.js'), join(sandbox.path, 'entry.js'));
    renameSync(join(sandbox.path, 'helper'), join(sandbox.path, 'app'));
    await Bun.write(join(sandbox.path, 'entry.js'), 'export const command = 1;\n');
    const accepted = await run(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/identifiers', status: 'ok', findings: [] },
        { check: 'naming/paths', status: 'ok', findings: [] },
    ]);
});

test('ordinary service and generation names pass the naming checks in code and paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['javascript', 'naming'], '', 'all'),
        'service/generate.js': 'export function generate() { return "message"; }\nexport const service = generate();\n',
    });
    const result = await run(sandbox.path, ['check', '--only', 'naming/identifiers', 'naming/paths', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'ok'],
        ['naming/paths', 'ok'],
    ]);
});
