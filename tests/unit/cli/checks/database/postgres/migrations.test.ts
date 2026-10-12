import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { DEFAULT_MIGRATION_FOLDER_FILES } from '#tests/config/postgres.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';

test('unreadable SQL is an error and the fixed migration is read', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        'migrations/20240201_teams.sql': 'CREATE TABLE ;',
    });
    expect(
        await rejection(readMigrations(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'))),
    ).toContain('migrations/20240201_teams.sql:1:14:');
    await writeFile(
        join(sandbox.path, 'migrations/20240201_teams.sql'),
        'CREATE TABLE teams (id integer PRIMARY KEY);\n',
    );
    const restored = await readMigrations(
        buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'),
    );
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});

test('dbmate and golang-migrate replays exclude rollback SQL', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['postgres']),
        'db/migrations/1_teams.sql': '-- migrate:up\nCREATE TABLE teams (id int);\n-- migrate:down\nDROP TABLE teams;',
        'db/migrations/2_secure.up.sql': 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
        'db/migrations/2_secure.down.sql': 'ALTER TABLE teams DISABLE ROW LEVEL SECURITY;',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order');
    const migrations = await readMigrations(input);
    expect(migrations.map((migration) => migration.name)).toStrictEqual(['1_teams.sql', '2_secure.up.sql']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await CHECK_FUNCTIONS['postgres/migration-order'](input)).toStrictEqual([]);
});

test('the default migration folders are read in root and child scopes, and a set folder replaces them', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['postgres'], {
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
    for (const scope of ['', 'app']) {
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'postgres/migration-order', { scope });
        const migrations = await readMigrations(input);
        expect(migrations.map(({ name }) => name)).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql']);
        expect(
            planRun(session, { stage: 'commit', only: ['postgres/squawk'] })
                .find((plan) => plan.scope.scope.path === scope)!
                .files.map(({ path }) => basename(path))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql', '4_rollback.down.sql']);
    }
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        settings + '[postgres]\nmigrations_folder = "custom"\n[scope.postgres]\nmigrations_folder = "app/custom"\n',
    );
    for (const scope of ['', 'app']) {
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'postgres/migration-order', { scope });
        const migrations = await readMigrations(input);
        expect(migrations.map(({ name }) => name)).toStrictEqual(['5_custom.sql']);
        expect(
            planRun(session, { stage: 'commit', only: ['postgres/squawk'] })
                .find((plan) => plan.scope.scope.path === scope)!
                .files.map(({ path }) => basename(path)),
        ).toStrictEqual(['5_custom.sql']);
    }
});
