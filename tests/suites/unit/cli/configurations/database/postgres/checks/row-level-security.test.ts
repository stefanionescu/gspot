import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('row security reports a table without row level security and passes after the fix', async () => {
    const path = 'migrations/1_tables.sql';
    await using sandbox = await createGitSandbox({
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
    await using sandbox = await createGitSandbox({
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

test.each([
    ['CREATE POLICY reader ON teams USING (id = 1);', 'policy-without-roles'],
    ['CREATE POLICY reader ON teams TO authenticated USING (owner = auth.uid());', 'per-row-identity-call'],
    [
        "CREATE POLICY reader ON teams TO authenticated WITH CHECK (tenant = current_setting('app.tenant'));",
        'per-row-identity-call',
    ],
    ['CREATE POLICY reader ON teams TO anon USING (true);', 'open-policy'],
    ['CREATE VIEW public.team_names AS SELECT 1;', 'view-without-security-invoker'],
    ['CREATE VIEW public.team_names WITH (security_invoker = false) AS SELECT 1;', 'view-without-security-invoker'],
])('row security reports %s as %s', async (statement, rule) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nclient_schemas = ["public"]\n' }),
        'migrations/1_tables.sql': `CREATE TABLE teams (id int);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\n${statement}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/row-level-security');
    expect(findings.map((finding) => finding.rule)).toStrictEqual([rule]);
});

test.each([
    'CREATE POLICY reader ON teams TO authenticated USING (owner = (select auth.uid()));',
    '-- The catalog is public.\nCREATE POLICY reader ON teams TO anon USING (true);',
    'CREATE POLICY reader ON teams TO anon USING (true); -- The catalog is public.',
    'CREATE VIEW public.team_names WITH (security_invoker = true) AS SELECT 1;',
    'CREATE VIEW public.team_names AS SELECT 1;\nALTER VIEW public.team_names SET (security_invoker = true);',
    'CREATE VIEW private.team_names AS SELECT 1;',
    'CREATE VIEW public.team_names AS SELECT 1;\nDROP VIEW public.team_names;',
])('row security accepts %s', async (statement) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nclient_schemas = ["public"]\n' }),
        'migrations/1_tables.sql': `CREATE TABLE teams (id int);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\n${statement}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security')).toStrictEqual([]);
});

test('row security leaves the policies of a frozen migration alone', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            tables: '[postgres]\nclient_schemas = ["public"]\nfrozen_through = "1"\n',
        }),
        'migrations/1_tables.sql':
            'CREATE TABLE teams (id int);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\nCREATE POLICY reader ON teams USING (id = 1);\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security')).toStrictEqual([]);
});
