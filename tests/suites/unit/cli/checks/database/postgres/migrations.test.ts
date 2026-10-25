import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    POSTGRES_CHECKS,
    MALFORMED_MIGRATION_PATH,
    MALFORMED_MIGRATION_FILES,
    DEFAULT_MIGRATION_FOLDER_FILES,
} from '#tests/config/checks/database/postgres/migrations.ts';

test('postgres/migration-order reports a migration that does not parse at its line and column, the other postgres checks skip, and the fixed migration passes', async () => {
    await using sandbox = await testdir(MALFORMED_MIGRATION_FILES);
    const checks = [...POSTGRES_CHECKS];

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    const syntax = failed.report.checks.find(({ check }) => check === 'postgres/migration-order');
    expect(syntax?.status).toBe('failed');
    expect(syntax?.findings).toMatchObject([{ file: MALFORMED_MIGRATION_PATH, line: 1, column: 14, rule: 'syntax' }]);
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
        'db/migrations/2_secure.up.sql': 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
        'db/migrations/2_secure.down.sql': 'ALTER TABLE teams DISABLE ROW LEVEL SECURITY;',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order');
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map((migration) => migration.name)).toStrictEqual(['1_teams.sql', '2_secure.up.sql']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await findBuiltInCheck('postgres/migration-order')(session, input)).toStrictEqual([]);
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
            .find((plan) => plan.scope.folder.path === scope)!
            .files.map(({ path }) => basename(path))
            .toSorted((left, right) => left.localeCompare(right)),
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
            .find((plan) => plan.scope.folder.path === scope)!
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
        expect(await findBuiltInCheck('postgres/migration-order')(session, input)).toStrictEqual([]);
        expect(
            await findBuiltInCheck('postgres/grants')(session, planSandboxCheck(session, 'postgres/grants')),
        ).toMatchObject([{ file: path, rule: 'grant-all' }]);
    },
);
