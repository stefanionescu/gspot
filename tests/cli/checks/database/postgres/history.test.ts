import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import { PATH, ORIGINAL } from '#tests/config/cli/checks/database/postgres/history.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';

const POSTGRES_HISTORY_POLICY = buildPolicy(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' });

test('migration history reports changed committed SQL and an earlier new version, then accepts corrections', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: ORIGINAL });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    expect(
        await migrationsFrozen(buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    gitOutput(sandbox.path, [
        '-c',
        'user.name=Example',
        '-c',
        'user.email=example@example.com',
        'commit',
        '-m',
        'Fixture',
    ]);
    writeFileSync(join(sandbox.path, PATH), ORIGINAL + 'ALTER TABLE teams ADD COLUMN name text;\n');
    await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
    gitOutput(sandbox.path, ['add', '.']);
    expect(
        await migrationsFrozen(buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([
        {
            check: 'postgres/migrations-frozen',
            file: PATH,
            line: 1,
            rule: 'frozen',
            fixable: false,
            message: 'This migration has run, and its text changed. Write a new migration.',
        },
    ]);
    expect(
        await migrationOrder(buildEngineInput(await openSession(sandbox.path), 'postgres/migration-order')),
    ).toStrictEqual([
        {
            check: 'postgres/migration-order',
            file: 'migrations/20240101_early.sql',
            line: 1,
            rule: 'order',
            fixable: false,
            message: 'A new migration sorts before 20240201_teams.sql, which is already committed.',
        },
    ]);
    writeFileSync(join(sandbox.path, PATH), ORIGINAL);
    gitOutput(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(
        await migrationsFrozen(buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    expect(
        await migrationOrder(buildEngineInput(await openSession(sandbox.path), 'postgres/migration-order')),
    ).toStrictEqual([]);
    const read = buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen');
    const branch = gitOutput(sandbox.path, ['symbolic-ref', 'HEAD']);
    writeFileSync(join(sandbox.path, '.git', branch), 'broken');
    await rejects(migrationsFrozen(read), { message: /Cannot read committed Git history/u });
});

test('nested scopes keep migration roots and parsed reads separate', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], {
            tables: '[[scope]]\npath = "apps/one"\nconfigurations = ["postgres"]\n[[scope]]\npath = "apps/two"\nconfigurations = ["postgres"]\n[scope.postgres]\nmigrations_folder = "schema"\n',
        }),
        [PATH]: ORIGINAL,
        'apps/one/migrations/20240101_one.sql': 'SELECT 1;\n',
        'apps/two/schema/20240101_two.sql': 'SELECT 2;\n',
    });
    const session = await openSession(sandbox.path);
    const spec = session.scopes[0]!.selected.flatMap((manifest) => manifest.checks).find(
        (check) => check.name === 'postgres/migration-order',
    )!;
    const expected: Record<string, string> = {
        '': PATH,
        'apps/one': 'apps/one/migrations/20240101_one.sql',
        'apps/two': 'apps/two/schema/20240101_two.sql',
    };
    for (const selected of session.scopes) {
        const scopeInput = engineInput(session, { scope: selected, spec, files: session.repository.files });
        const migrations = await migrationsOf(scopeInput);
        expect(migrations.map((migration) => migration.path)).toStrictEqual([expected[selected.scope.path]!]);
        expect(await migrationOrder(scopeInput)).toStrictEqual([]);
    }
});

test('migration analysis rejects unreadable SQL and accepts its correction in a new run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: 'CREATE TABLE ;' });
    expect(
        await rejection(migrationsOf(buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen'))),
    ).toContain('migrations/20240201_teams.sql:1:14:');
    writeFileSync(join(sandbox.path, PATH), ORIGINAL);
    const restored = await migrationsOf(
        buildEngineInput(await openSession(sandbox.path), 'postgres/migrations-frozen'),
    );
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});
