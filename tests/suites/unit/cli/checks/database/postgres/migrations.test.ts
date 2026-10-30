import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { buildDatabaseSchema } from '#cli/checks/database/postgres/schema.ts';
import { ROW_SECURITY_SQL } from '#tests/config/checks/database/postgres/statements.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    POSTGRES_CHECKS,
    MALFORMED_MIGRATION_PATH,
    DEFAULT_MIGRATION_FOLDER_FILES,
} from '#tests/config/checks/database/postgres/migrations.ts';

test('postgres/migration-order reports a migration that does not parse at its line and column, the other postgres checks skip, and the fixed migration passes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            tables: '[postgres]\nfrozen_through = "all"\nclient_schemas = ["public"]\n',
        }),
        [MALFORMED_MIGRATION_PATH]: 'CREATE TABLE ;',
    });
    const checks = [...POSTGRES_CHECKS];

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    const syntax = failed.report.checks.find(({ check }) => check === 'postgres/migration-order');
    expect(syntax?.status).toBe('failed');
    expect(syntax?.findings).toStrictEqual([
        {
            check: 'postgres/migration-order',
            file: MALFORMED_MIGRATION_PATH,
            line: 1,
            column: 14,
            rule: 'syntax',
            message: 'syntax error at or near ";"',
            fixable: false,
            help: 'Rename the new migration with a version later than the newest committed one.',
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
                note: 'A migration does not parse. postgres/migration-order reports where.',
            })),
    );
    await writeFile(
        join(sandbox.path, MALFORMED_MIGRATION_PATH),
        'CREATE TABLE teams (id integer PRIMARY KEY);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\n',
    );
    const fixed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    expect(fixed.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual(
        checks.map((check) => ({ check, status: 'passed', findings: [] })),
    );
});

test('dbmate and golang-migrate replays exclude rollback SQL', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'db/migrations/1_teams.sql': '-- migrate:up\nCREATE TABLE teams (id int);\n-- migrate:down\nDROP TABLE teams;',
        'db/migrations/2_secure.up.sql': ROW_SECURITY_SQL,
        'db/migrations/2_secure.down.sql': 'ALTER TABLE teams DISABLE ROW LEVEL SECURITY;',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order');
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map((migration) => migration.name)).toStrictEqual(['1_teams.sql', '2_secure.up.sql']);
    expect(buildDatabaseSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await getBuiltInCheck('postgres/migration-order')(session, input)).toStrictEqual([]);
});

test.each(['', 'app'])('the default migration folders are read and a set folder replaces them in %j', async (scope) => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['postgres'], { scopes: [{ path: 'app', configurations: ['postgres'] }] });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    for (const folder of ['', 'app'])
        await createFileTree(
            sandbox.path,
            Object.fromEntries(
                Object.entries(DEFAULT_MIGRATION_FOLDER_FILES).map(([path, text]) => [join(folder, path), text]),
            ),
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
        settings + '[postgres]\nmigrations_folder = "custom"\n[scope.postgres]\nmigrations_folder = "app/custom"\n',
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
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['postgres']),
            [path]: 'GRANT ALL ON TABLE orders TO app_reader;\n',
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'postgres/migration-order');
        const { migrations } = await readMigrations(session, input);
        expect(migrations.map(({ version }) => version)).toStrictEqual([
            path.startsWith('prisma/') ? '20260101000000' : '0001',
        ]);
        expect(await getBuiltInCheck('postgres/migration-order')(session, input)).toStrictEqual([]);
        expect(
            await getBuiltInCheck('postgres/grants')(session, planSandboxCheck(session, 'postgres/grants')),
        ).toMatchObject([{ file: path, rule: 'grant-all' }]);
    },
);

test.each(['', 'V'])('unpadded %s migration versions replay and freeze in numeric order', async (prefix) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
        [`migrations/${prefix}9_create.sql`]: 'CREATE TABLE teams (id int);',
        [`migrations/${prefix}10_secure.sql`]: ROW_SECURITY_SQL,
    });

    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        [`migrations/${prefix}8_earlier.sql`]: 'SELECT 8;',
        [`migrations/${prefix}11_later.sql`]: 'SELECT 11;',
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order');
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
    expect(buildDatabaseSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await getBuiltInCheck('postgres/migration-order')(session, input)).toMatchObject([
        { file: `migrations/${prefix}8_earlier.sql`, rule: 'order' },
    ]);
    await writeFile(join(sandbox.path, `migrations/${prefix}10_secure.sql`), 'SELECT 10;');
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
    await writeFile(join(sandbox.path, `migrations/${prefix}9_create.sql`), 'CREATE TABLE teams (id bigint);');
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toMatchObject([
        { file: `migrations/${prefix}9_create.sql`, rule: 'frozen' },
    ]);
});

test('Flyway component versions remain distinct and dollar-quoted down markers stay inside their function', async () => {
    await using sandbox = await testdir({
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
