import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { DEFAULT_MIGRATION_FOLDER_FILES } from '#tests/data/checks/postgres.ts';

test('unreadable SQL reports its syntax location and the fixed migration is read', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        'migrations/20240201_teams.sql': 'CREATE TABLE ;',
    });
    const parsed = await readMigrations(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'));
    expect(parsed.findings).toMatchObject([
        { file: 'migrations/20240201_teams.sql', line: 1, column: 14, rule: 'syntax' },
    ]);
    await writeFile(
        join(sandbox.path, 'migrations/20240201_teams.sql'),
        'CREATE TABLE teams (id integer PRIMARY KEY);\n',
    );
    const { migrations: restored } = await readMigrations(
        buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'),
    );
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});

test('dbmate and golang-migrate replays exclude rollback SQL', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['postgres']),
        'db/migrations/1_teams.sql': '-- migrate:up\nCREATE TABLE teams (id int);\n-- migrate:down\nDROP TABLE teams;',
        'db/migrations/2_secure.up.sql': 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
        'db/migrations/2_secure.down.sql': 'ALTER TABLE teams DISABLE ROW LEVEL SECURITY;',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order');
    const { migrations } = await readMigrations(input);
    expect(migrations.map((migration) => migration.name)).toStrictEqual(['1_teams.sql', '2_secure.up.sql']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await CHECK_IMPLEMENTATIONS['postgres/migration-order'].check(input)).toStrictEqual([]);
});

test.each(['', 'app'])('the default migration folders are read and a set folder replaces them in %j', async (scope) => {
    await using sandbox = await testdir();
    const settings = buildSettingsText(['postgres'], {
        tables: '[[scope]]\npath = "app"\nconfigurations = ["postgres"]\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    for (const scope of ['', 'app'])
        await createFileTree(
            sandbox.path,
            Object.fromEntries(
                Object.entries(DEFAULT_MIGRATION_FOLDER_FILES).map(([path, text]) => [join(scope, path), text]),
            ),
        );

    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'postgres/migration-order', { scope });
    const { migrations } = await readMigrations(input);
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
    const replacedInput = buildCheckInput(replacedSession, 'postgres/migration-order', { scope });
    const { migrations: replacedMigrations } = await readMigrations(replacedInput);
    expect(replacedMigrations.map(({ name }) => name)).toStrictEqual(['5_custom.sql']);
    expect(
        planRun(replacedSession, { stage: 'commit', only: ['postgres/squawk'] })
            .find((plan) => plan.selection.scope.path === scope)!
            .files.map(({ path }) => basename(path)),
    ).toStrictEqual(['5_custom.sql']);
});
