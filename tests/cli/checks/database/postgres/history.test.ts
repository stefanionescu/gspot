import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
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
        await migrationsFrozen(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
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
        await migrationsFrozen(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([
        {
            check: 'postgres/migrations-frozen',
            file: PATH,
            line: 1,
            rule: 'frozen',
            fixable: false,
            message:
                'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.',
        },
    ]);
    expect(
        await migrationOrder(buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order')),
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
        await migrationsFrozen(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    expect(
        await migrationOrder(buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order')),
    ).toStrictEqual([]);
    const read = buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen');
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
    const check = session.scopes[0]!.selected.flatMap((manifest) => manifest.checks).find(
        (check) => check.name === 'postgres/migration-order',
    )!;
    const expected: Record<string, string> = {
        '': PATH,
        'apps/one': 'apps/one/migrations/20240101_one.sql',
        'apps/two': 'apps/two/schema/20240101_two.sql',
    };
    for (const selected of session.scopes) {
        const scopeInput = checkInput(session, { scope: selected, check, files: session.repository.files });
        const migrations = await migrationsOf(scopeInput);
        expect(migrations.map((migration) => migration.path)).toStrictEqual([expected[selected.scope.path]!]);
        expect(await migrationOrder(scopeInput)).toStrictEqual([]);
    }
});

test('migration analysis rejects unreadable SQL and accepts its correction in a new run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: 'CREATE TABLE ;' });
    expect(
        await rejection(migrationsOf(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'))),
    ).toContain('migrations/20240201_teams.sql:1:14:');
    writeFileSync(join(sandbox.path, PATH), ORIGINAL);
    const restored = await migrationsOf(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'));
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});

test('unpadded migration versions replay and freeze in numeric order', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
        'migrations/9_create.sql': 'CREATE TABLE teams (id int);',
        'migrations/10_secure.sql': 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        'migrations/8_earlier.sql': 'SELECT 8;',
        'migrations/11_later.sql': 'SELECT 11;',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'postgres/migration-order');
    const migrations = await migrationsOf(input);
    expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await migrationOrder(input)).toMatchObject([{ file: 'migrations/8_earlier.sql', rule: 'order' }]);
    await Bun.write(join(sandbox.path, 'migrations/10_secure.sql'), 'SELECT 10;');
    expect(
        await migrationsFrozen(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'migrations/9_create.sql'), 'CREATE TABLE teams (id bigint);');
    expect(
        await migrationsFrozen(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toMatchObject([{ file: 'migrations/9_create.sql', rule: 'frozen' }]);
});

test('dbmate and golang-migrate replays exclude rollback SQL', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres']),
        'db/migrations/1_teams.sql': '-- migrate:up\nCREATE TABLE teams (id int);\n-- migrate:down\nDROP TABLE teams;',
        'db/migrations/2_secure.up.sql': 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
        'db/migrations/2_secure.down.sql': 'ALTER TABLE teams DISABLE ROW LEVEL SECURITY;',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order');
    const migrations = await migrationsOf(input);
    expect(migrations.map((migration) => migration.name)).toStrictEqual(['1_teams.sql', '2_secure.up.sql']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await migrationOrder(input)).toStrictEqual([]);
});

test('history reads only selected migration blobs and shares reads without mixing scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], {
            tables: '[postgres]\nfrozen_through = "all"\n[[scope]]\npath = "apps/api"\nconfigurations = ["postgres"]\n',
        }),
        'migrations/1_root.sql': 'SELECT 1;',
        'apps/api/migrations/2_api.sql': 'SELECT 2;',
        'schema/unrelated.sql': 'SELECT 3;',
    });
    commitAll(sandbox.path);
    const rootHash = gitOutput(sandbox.path, ['rev-parse', 'HEAD:migrations/1_root.sql']);
    const childHash = gitOutput(sandbox.path, ['rev-parse', 'HEAD:apps/api/migrations/2_api.sql']);
    const session = await openSession(sandbox.path);
    const requests: string[] = [];
    const runStream = processes.runStream;
    using _stream = spyOn(processes, 'runStream').mockImplementation((argv, options, output) => {
        if (argv[0] === 'git' && argv[1] === 'cat-file') requests.push(options.stdin!);
        return runStream(argv, options, output);
    });
    expect(await migrationOrder(buildCheckInput(session, 'postgres/migration-order'))).toStrictEqual([]);
    expect(await migrationsFrozen(buildCheckInput(session, 'postgres/migrations-frozen'))).toStrictEqual([]);
    expect(
        await migrationOrder(buildCheckInput(session, 'postgres/migration-order', { scope: 'apps/api' })),
    ).toStrictEqual([]);
    expect(
        await migrationsFrozen(buildCheckInput(session, 'postgres/migrations-frozen', { scope: 'apps/api' })),
    ).toStrictEqual([]);
    expect(requests).toStrictEqual([rootHash + '\n', childHash + '\n']);
});
