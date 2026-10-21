import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { runChecks } from '#cli/runs/run.ts';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readMigrations } from '#cli/checks/postgres/migrations.ts';
import { planSandboxCheck, findBuiltInCheck } from '#tests/setup/check-input.ts';
import { MALFORMED_MIGRATION_FILES, DEFAULT_MIGRATION_FOLDER_FILES } from '#tests/data/checks/postgres.ts';

test('postgres/migration-order reports a migration that does not parse at its line and column, the other postgres checks skip, and the fixed migration passes', async () => {
    await using sandbox = await testdir(MALFORMED_MIGRATION_FILES);
    const checks = [
        'postgres/migration-order',
        'postgres/edited-migrations',
        'postgres/row-level-security',
        'postgres/grants',
        'postgres/definer-search-path',
        'postgres/foreign-key-indexes',
    ];

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    const syntax = failed.report.checks.find(({ check }) => check === 'postgres/migration-order');
    expect(syntax?.status).toBe('failed');
    expect(syntax?.findings).toMatchObject([
        { file: 'migrations/20240201_teams.sql', line: 1, column: 14, rule: 'syntax' },
    ]);
    expect(
        failed.report.checks
            .filter(({ check }) => check !== 'postgres/migration-order')
            .map(({ check, status, findings, note }) => ({ check, status, findings, note }))
            .toSorted((left, right) => left.check.localeCompare(right.check)),
    ).toStrictEqual(
        checks
            .slice(1)
            .toSorted((left, right) => left.localeCompare(right))
            .map((check) => ({
                check,
                status: 'skipped',
                findings: [],
                note: 'A migration does not parse. postgres/migration-order reports where.',
            })),
    );
    await writeFile(
        join(sandbox.path, 'migrations/20240201_teams.sql'),
        'CREATE TABLE teams (id integer PRIMARY KEY);\nALTER TABLE teams ENABLE ROW LEVEL SECURITY;\n',
    );
    const fixed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: checks }));

    expect(fixed.report.checks).toHaveLength(checks.length);
    expect(fixed.report.checks.every(({ status, findings }) => status === 'passed' && findings.length === 0)).toBe(
        true,
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
    for (const scope of ['', 'app'])
        await createFileTree(
            sandbox.path,
            Object.fromEntries(
                Object.entries(DEFAULT_MIGRATION_FOLDER_FILES).map(([path, text]) => [join(scope, path), text]),
            ),
        );

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order', { scope });
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map(({ name }) => name)).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql']);
    expect(
        planRun(session, { stage: 'commit', only: ['postgres/squawk'] })
            .find((plan) => plan.selection.scope.path === scope)!
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
        planRun(replacedSession, { stage: 'commit', only: ['postgres/squawk'] })
            .find((plan) => plan.selection.scope.path === scope)!
            .files.map(({ path }) => basename(path)),
    ).toStrictEqual(['5_custom.sql']);
});

test('a migration that does not parse gets one syntax finding, from postgres/migration-order', async () => {
    await using sandbox = await testdir(MALFORMED_MIGRATION_FILES);
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({}));
    const syntax = report.checks.flatMap(({ check, findings }) =>
        findings.filter(({ rule }) => rule === 'syntax').map(() => check),
    );
    expect(syntax).toStrictEqual(['postgres/migration-order']);
});
