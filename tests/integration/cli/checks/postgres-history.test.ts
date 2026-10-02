import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { sessionInput } from '#tests/harness/cli/input.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';

const POSTGRES_HISTORY_POLICY = policyOf(['postgres'], '[tools.squawk]\nfrozen_through = "all"\n');

const ORIGINAL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';

const PATH = 'migrations/20240201_teams.sql';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

test('migration history reports changed committed SQL and an earlier new version, then accepts corrections', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: ORIGINAL });
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    expect(await migrationsFrozen(await sessionInput(sandbox.path, 'postgres/migrations-frozen'))).toStrictEqual([]);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Fixture']);
    writeFileSync(join(sandbox.path, PATH), ORIGINAL + 'ALTER TABLE teams ADD COLUMN name text;\n');
    await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
    git(sandbox.path, ['add', '.']);
    expect(await migrationsFrozen(await sessionInput(sandbox.path, 'postgres/migrations-frozen'))).toStrictEqual([
        {
            check: 'postgres/migrations-frozen',
            file: PATH,
            line: 1,
            rule: 'frozen',
            fixable: false,
            message: 'This migration has run, and its text changed. Write a new migration.',
        },
    ]);
    expect(await migrationOrder(await sessionInput(sandbox.path, 'postgres/migration-order'))).toStrictEqual([
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
    git(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(await migrationsFrozen(await sessionInput(sandbox.path, 'postgres/migrations-frozen'))).toStrictEqual([]);
    expect(await migrationOrder(await sessionInput(sandbox.path, 'postgres/migration-order'))).toStrictEqual([]);
    const read = await sessionInput(sandbox.path, 'postgres/migrations-frozen');
    const branch = git(sandbox.path, ['symbolic-ref', 'HEAD']);
    writeFileSync(join(sandbox.path, '.git', branch), 'broken');
    await rejects(migrationsFrozen(read), { message: /Cannot read committed Git history/u });
});

test('nested scopes keep migration roots and parsed reads separate', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['postgres'],
            '[[scope]]\npath = "apps/one"\nkits = ["postgres"]\n[[scope]]\npath = "apps/two"\nkits = ["postgres"]\n[scope.tools.postgres]\nmigrations_directory = "schema"\n',
        ),
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
    expect(await rejection(migrationsOf(await sessionInput(sandbox.path, 'postgres/migrations-frozen')))).toContain(
        'SQL parse failed',
    );
    writeFileSync(join(sandbox.path, PATH), ORIGINAL);
    const restored = await migrationsOf(await sessionInput(sandbox.path, 'postgres/migrations-frozen'));
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});
