import type { RunReport } from '#cli/types/reports.ts';
import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('SQL migration names retain their timestamp while enforcing snake case', async () => {
    await using sandbox = await testdir();
    const invalid = 'migrations/20260101120000_CreateUsers.sql';
    const valid = 'migrations/20260101120000_create_users.sql';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["sql", "naming"]\n',
        [invalid]: 'CREATE TABLE users (id integer);\n',
        'queries/select_users.sql': 'SELECT id FROM users;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--no-cache', '--json'];
    const refused = await run(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
        { file: invalid, line: 1, column: 1, rule: 'case' },
    ]);
    renameSync(join(sandbox.path, invalid), join(sandbox.path, valid));
    const accepted = await run(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});
