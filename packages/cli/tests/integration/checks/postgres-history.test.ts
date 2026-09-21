import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { EngineInput } from '#types/run.ts';
import { openSession } from '#cli/run/session.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/postgres/history.ts';

const POLICY = 'version = 1\npresets = ["postgres"]\n[tools.squawk]\nfrozen_through = "all"\n';
const ORIGINAL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';
const PATH = 'migrations/20240201_teams.sql';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

async function input(root: string, name: string): Promise<EngineInput> {
    const session = await openSession(root);
    const selected = session.scopes[0]!;
    const spec = selected.selected.flatMap((manifest) => manifest.checks).find((check) => check.name === name)!;
    return { session, root, scope: '', view: selected.view, spec, files: session.repository.files };
}

test('migration history reports changed committed SQL and an earlier new version, then accepts corrections', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POLICY, [PATH]: ORIGINAL });
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    expect(await migrationsFrozen(await input(sandbox.path, 'postgres/migrations-frozen'))).toEqual([]);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Fixture']);
    writeFileSync(join(sandbox.path, PATH), ORIGINAL + 'ALTER TABLE teams ADD COLUMN name text;\n');
    await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
    git(sandbox.path, ['add', '.']);
    expect(await migrationsFrozen(await input(sandbox.path, 'postgres/migrations-frozen'))).toEqual([
        {
            check: 'postgres/migrations-frozen',
            file: PATH,
            line: 1,
            rule: 'frozen',
            fixable: false,
            message: 'This migration has run, and its text changed. Write a new migration.',
        },
    ]);
    expect(await migrationOrder(await input(sandbox.path, 'postgres/migration-order'))).toEqual([
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
    expect(await migrationsFrozen(await input(sandbox.path, 'postgres/migrations-frozen'))).toEqual([]);
    expect(await migrationOrder(await input(sandbox.path, 'postgres/migration-order'))).toEqual([]);
    const observed = await input(sandbox.path, 'postgres/migrations-frozen');
    const branch = git(sandbox.path, ['symbolic-ref', 'HEAD']);
    writeFileSync(join(sandbox.path, '.git', branch), 'broken');
    await rejects(migrationsFrozen(observed), { message: /Cannot read committed Git history/u });
});

test('nested scopes keep migration roots and parsed observations separate', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = ["postgres"]\n[[scope]]\npath = "apps/one"\npresets = ["postgres"]\n[[scope]]\npath = "apps/two"\npresets = ["postgres"]\n[scope.tools.postgres]\nmigrations_dir = "schema"\n',
        [PATH]: ORIGINAL,
        'apps/one/migrations/20240101_one.sql': 'SELECT 1;\n',
        'apps/two/schema/20240101_two.sql': 'SELECT 2;\n',
    });
    const base = await input(sandbox.path, 'postgres/migration-order');
    const expected: Record<string, string> = {
        '': PATH,
        'apps/one': 'apps/one/migrations/20240101_one.sql',
        'apps/two': 'apps/two/schema/20240101_two.sql',
    };
    for (const selected of base.session.scopes) {
        const scoped = { ...base, scope: selected.scope.path, view: selected.view };
        const migrations = await migrationsOf(scoped);
        expect(migrations.map((migration) => migration.path)).toEqual([expected[selected.scope.path]!]);
        expect(await migrationOrder(scoped)).toEqual([]);
        expect(await migrationsOf(scoped)).toBe(migrations);
    }
});
