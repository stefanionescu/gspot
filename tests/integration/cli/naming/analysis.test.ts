import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { RunReport } from '#cli/execution/report.ts';

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
    expect(JSON.parse(accepted.stdout).checks).toMatchObject([{ check: 'naming/paths', status: 'ok', findings: [] }]);
});

test('naming policy validates inherited and scoped declarations against the complete source inventory', async () => {
    await using sandbox = await testdir();
    const policy = `version = 1
configurations = ["naming", "bash"]
[naming]
allowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]
[[naming.rules]]
paths = ["web/source.js"]
names = ["remoteRecord"]
exclude = true
reason = "The external JavaScript interface fixes this name."
[[scope]]
path = "web"
configurations = ["javascript"]
[scope.naming]
allowed = [{name = "remoteRecord", reason = "The external JavaScript interface fixes this name."}]
[[scope]]
path = "worker"
configurations = ["python"]
[scope.naming]
allowed = [{name = "remote_record", reason = "The external Python interface fixes this name."}]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'entry.sh': 'echo ready\n',
        'web/source.js': 'export const remoteRecord = 1;\n',
        'worker/source.py': 'remote_record = 1\n',
    });
    const command = ['check', '--only', 'naming/policy-schema', '--no-cache', '--json'];
    const accepted = await run(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const complete = JSON.parse(accepted.stdout) as RunReport;
    expect(complete.checks.map(({ check, scope, status }) => ({ check, scope, status }))).toStrictEqual([
        { check: 'naming/policy-schema', scope: '', status: 'ok' },
    ]);
    const narrowed = await run(sandbox.path, [
        'check',
        'entry.sh',
        '--only',
        'naming/policy-schema',
        '--no-cache',
        '--json',
    ]);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    const invalid = policy.replace('name = "remote_record"', 'name = "remoteRecord"');
    await Bun.write(join(sandbox.path, 'gspot.toml'), invalid);
    const refused = await run(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = JSON.parse(refused.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'gspot.toml',
            message: 'naming.allowed names "remoteRecord", which no identifier in this scope carries. (scope worker)',
        },
    ]);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(invalid);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const localRecord = 1;\n');
    const unused = await run(sandbox.path, command);
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect((JSON.parse(unused.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(2);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const remoteRecord = 1;\n');
    renameSync(join(sandbox.path, 'web/source.js'), join(sandbox.path, 'web/renamed.js'));
    const unmatched = await run(sandbox.path, command);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(1);
    expect((JSON.parse(unmatched.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'gspot.toml', message: 'A [[naming.rules]] entry matches no file: web/source.js.' },
    ]);
    renameSync(join(sandbox.path, 'web/renamed.js'), join(sandbox.path, 'web/source.js'));
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout).checks).toMatchObject([
        { check: 'naming/policy-schema', status: 'ok', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'worker/source.py')).text()).toBe('remote_record = 1\n');
});
