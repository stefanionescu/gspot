import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { readMigrations, selectFrozenMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { compareText } from '#cli/system/text/order.ts';
import { FROZEN_MIGRATION_CASES, FROZEN_MIGRATION_PATHS } from '#tests/config/configurations/database.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('postgres/migration-order reports a migration that does not parse at its line and column, and the other postgres checks skip', async () => {
    const path = 'migrations/1_teams.sql';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            tables: '[postgres]\nfrozen_through = "all"\nclient_schemas = ["public"]\n',
        }),
        [path]: 'CREATE TABLE ;',
    });
    const checks = (readConfigurations().get('postgres')?.checks ?? [])
        .filter(({ command }) => command === undefined)
        .map(({ id }) => id);
    expect(checks).toContain('postgres/migration-order');

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    const syntax = failed.report.checks.find(({ check }) => check === 'postgres/migration-order');
    expect(syntax?.status).toBe('failed');
    expect(syntax?.findings.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual([
        {
            file: path,
            line: 1,
            column: 14,
            rule: 'syntax',
        },
    ]);
    expect(
        failed.report.checks
            .filter(({ check }) => check !== 'postgres/migration-order')
            .map(({ check, status, findings, note }) => ({ check, status, findings, note })),
    ).toStrictEqual(
        checks
            .filter((check) => check !== 'postgres/migration-order')
            .map((check) => ({
                check,
                status: 'skipped',
                findings: [],
                note: expect.stringContaining('postgres/migration-order') as string,
            })),
    );
});

test.each(['', 'app'])('the default migration folders are read and a set folder replaces them in %j', async (scope) => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['postgres'], { scopes: [{ path: 'app', configurations: ['postgres'] }] });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    const files = {
        'supabase/migrations/1_first.sql': 'CREATE TABLE first_table(id int);',
        'db/migrations/2_second.sql': 'CREATE TABLE second_table(id int);',
        'migrations/3_third.sql': 'CREATE TABLE third_table(id int);',
        'migrations/4_rollback.down.sql': 'invalid SQL;',
        'custom/5_custom.sql': 'CREATE TABLE custom_table(id int);',
        'custom_extra/6_ignored.sql': 'invalid SQL;',
    };
    for (const folder of ['', 'app'])
        await createFileTree(
            sandbox.path,
            Object.fromEntries(Object.entries(files).map(([path, text]) => [join(folder, path), text])),
        );

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order', { scope });
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map(({ name }) => name)).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql']);
    expect(
        planChecks(session, { stage: 'commit', only: ['postgres/squawk'] })
            .find((plan) => plan.scope.path === scope)!
            .files.map(({ path }) => basename(path))
            .toSorted(compareText),
    ).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql', '4_rollback.down.sql']);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        `${settings}[postgres]\nmigrations_folder = "custom"\n[scope.postgres]\nmigrations_folder = "custom"\n`,
    );

    const replacedSession = await openSession(sandbox.path);
    const replacedInput = planSandboxCheck(replacedSession, 'postgres/migration-order', { scope });
    const { migrations: replacedMigrations } = await readMigrations(replacedSession, replacedInput);
    expect(replacedMigrations.map(({ name }) => name)).toStrictEqual(['5_custom.sql']);
    expect(
        planChecks(replacedSession, { stage: 'commit', only: ['postgres/squawk'] })
            .find((plan) => plan.scope.path === scope)!
            .files.map(({ path }) => basename(path)),
    ).toStrictEqual(['5_custom.sql']);
});

test.each(['prisma/migrations/20260101000000_init/migration.sql', 'drizzle/0001_init.sql'])(
    '%s is read by the Postgres checks with its migration version',
    async (path) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['postgres']),
            [path]: 'GRANT ALL ON TABLE orders TO app_reader;\n',
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'postgres/migration-order');
        const { migrations } = await readMigrations(session, input);
        expect(migrations.map(({ version }) => version)).toStrictEqual([
            path.startsWith('prisma/') ? '20260101000000' : '0001',
        ]);
    },
);

test('Flyway component versions remain distinct and dollar-quoted down markers stay inside their function', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/V1__first.sql': 'CREATE TABLE entries (id int);',
        'migrations/V1_1__second.sql':
            "CREATE FUNCTION sample() RETURNS text LANGUAGE sql AS $$\n-- migrate:down\nSELECT 'value';\n$$;\n-- migrate:down\nDROP TABLE entries;",
        'migrations/V1_10__later.sql': 'SELECT 1;',
        'migrations/V1_2__third.sql': 'SELECT 1;',
    });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'postgres/migration-order');
    const { migrations, findings } = await readMigrations(session, planned);
    expect(findings).toStrictEqual([]);
    expect(migrations.map(({ version }) => version)).toStrictEqual(['1', '1.1', '1.2', '1.10']);
    expect(migrations[1]?.text).toContain("SELECT 'value'");
    expect(migrations[1]?.text).not.toContain('DROP TABLE');
});

test.each([...FROZEN_MIGRATION_CASES])(
    'freeze version $through selects the frozen migrations',
    ({ through, frozen }) => {
        expect([...selectFrozenMigrations([...FROZEN_MIGRATION_PATHS], through)]).toStrictEqual([...frozen]);
    },
);
