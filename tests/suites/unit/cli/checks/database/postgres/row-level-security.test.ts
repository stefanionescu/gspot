import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('row security reports a table without row level security and passes after the fix', async () => {
    const path = 'migrations/1_tables.sql';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            tables: '[postgres]\nclient_schemas = ["public"]\n',
        }),
        [path]: `CREATE TABLE private_data (id int);
CREATE TABLE client_data (id int);
ALTER TABLE client_data ENABLE ROW LEVEL SECURITY;
`,
    });

    expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security')).toMatchObject([
        { check: 'postgres/row-level-security', file: path, line: 1, column: 1, rule: 'row-security' },
    ]);
    await writeFile(
        join(sandbox.path, path),
        `CREATE TABLE private_data (id int);
CREATE TABLE client_data (id int);
ALTER TABLE client_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_data ENABLE ROW LEVEL SECURITY;\n`,
    );

    expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security')).toStrictEqual([]);
});

test('row security skips when no client schemas are selected', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/1_orders.sql': 'CREATE TABLE public.orders (id bigint PRIMARY KEY);\n',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['postgres/row-level-security'] }),
    );
    expect(result.report.checks).toMatchObject([
        { status: 'skipped', findings: [], note: 'needs the setting postgres.client_schemas' },
    ]);
});
