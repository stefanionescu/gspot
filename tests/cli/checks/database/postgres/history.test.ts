import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { migrationsOf } from '#cli/checks/database/postgres/public.ts';
import { buildSchema } from '#cli/checks/database/postgres/contracts.ts';
import { PATH, ORIGINAL, MIGRATION_PREFIXES } from '#tests/config/cli/checks/database/postgres/history.ts';

const POSTGRES_HISTORY_POLICY = buildPolicy(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' });

test('migration history reports changed committed SQL and an earlier new version, then passes after fixes', async () => {
    const frozenCheck = BUILT_IN_CHECKS['postgres/migrations-frozen'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: ORIGINAL });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    expect(
        await frozenCheck.input(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    await writeFile(join(sandbox.path, PATH), ORIGINAL + 'ALTER TABLE teams ADD COLUMN name text;\n');
    await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
    gitOutput(sandbox.path, ['add', '.']);
    const frozen = await frozenCheck.input(
        buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'),
    );
    expect(frozen).toMatchObject([
        {
            check: 'postgres/migrations-frozen',
            file: PATH,
            line: 1,
            rule: 'frozen',
            fixable: false,
        },
    ]);
    expect(frozen[0]!.message).toContain('postgres.frozen_through');
    const order = await BUILT_IN_CHECKS['postgres/migration-order'].input(
        buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order'),
    );
    expect(order).toMatchObject([
        {
            check: 'postgres/migration-order',
            file: 'migrations/20240101_early.sql',
            line: 1,
            rule: 'order',
            fixable: false,
        },
    ]);
    expect(order[0]!.message).toContain(basename(PATH));
    await writeFile(join(sandbox.path, PATH), ORIGINAL);
    gitOutput(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(
        await frozenCheck.input(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen')),
    ).toStrictEqual([]);
    expect(
        await BUILT_IN_CHECKS['postgres/migration-order'].input(
            buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order'),
        ),
    ).toStrictEqual([]);
    const read = buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen');
    await writeFile(join(sandbox.path, '.git', gitOutput(sandbox.path, ['symbolic-ref', 'HEAD'])), 'broken');
    expect(await rejection(frozenCheck.input(read))).toContain('Cannot read committed Git history');
});

test('nested scopes keep migration roots and parsed reads separate', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], {
            tables: '[scope."apps/one"]\nconfigurations = ["postgres"]\n[scope."apps/two"]\nconfigurations = ["postgres"]\n[scope."apps/two".postgres]\nmigrations_folder = "schema"\n',
        }),
        [PATH]: ORIGINAL,
        'apps/one/migrations/20240101_one.sql': 'SELECT 1;\n',
        'apps/two/schema/20240101_two.sql': 'SELECT 2;\n',
    });
    const session = await openSession(sandbox.path);
    const expected: Record<string, string> = {
        '': PATH,
        'apps/one': 'apps/one/migrations/20240101_one.sql',
        'apps/two': 'apps/two/schema/20240101_two.sql',
    };
    for (const selected of session.scopes) {
        const scopeInput = buildCheckInput(session, 'postgres/migration-order', { scope: selected.scope.path });
        const migrations = await migrationsOf(scopeInput);
        expect(migrations.map((migration) => migration.path)).toStrictEqual([expected[selected.scope.path]!]);
        expect(await BUILT_IN_CHECKS['postgres/migration-order'].input(scopeInput)).toStrictEqual([]);
    }
});

test('migration analysis rejects unreadable SQL and passes after the fix in a new run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POSTGRES_HISTORY_POLICY, [PATH]: 'CREATE TABLE ;' });
    expect(
        await rejection(migrationsOf(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'))),
    ).toContain('migrations/20240201_teams.sql:1:14:');
    await writeFile(join(sandbox.path, PATH), ORIGINAL);
    const restored = await migrationsOf(buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'));
    expect(restored[0]?.statements[0]?.kind).toBe('CreateStmt');
});

test.each(MIGRATION_PREFIXES)('unpadded %s migration versions replay and freeze in numeric order', async (prefix) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
        [`migrations/${prefix}9_create.sql`]: 'CREATE TABLE teams (id int);',
        [`migrations/${prefix}10_secure.sql`]: 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        [`migrations/${prefix}8_earlier.sql`]: 'SELECT 8;',
        [`migrations/${prefix}11_later.sql`]: 'SELECT 11;',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'postgres/migration-order');
    const migrations = await migrationsOf(input);
    expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await BUILT_IN_CHECKS['postgres/migration-order'].input(input)).toMatchObject([
        { file: `migrations/${prefix}8_earlier.sql`, rule: 'order' },
    ]);
    await Bun.write(join(sandbox.path, `migrations/${prefix}10_secure.sql`), 'SELECT 10;');
    expect(
        await BUILT_IN_CHECKS['postgres/migrations-frozen'].input(
            buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'),
        ),
    ).toStrictEqual([]);
    await Bun.write(join(sandbox.path, `migrations/${prefix}9_create.sql`), 'CREATE TABLE teams (id bigint);');
    expect(
        await BUILT_IN_CHECKS['postgres/migrations-frozen'].input(
            buildCheckInput(await openSession(sandbox.path), 'postgres/migrations-frozen'),
        ),
    ).toMatchObject([{ file: `migrations/${prefix}9_create.sql`, rule: 'frozen' }]);
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
    expect(await BUILT_IN_CHECKS['postgres/migration-order'].input(input)).toStrictEqual([]);
});

test('history reads only selected migration blobs and shares reads without mixing scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], {
            tables: '[postgres]\nfrozen_through = "all"\n[scope."apps/api"]\nconfigurations = ["postgres"]\n',
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
    expect(
        await BUILT_IN_CHECKS['postgres/migration-order'].input(buildCheckInput(session, 'postgres/migration-order')),
    ).toStrictEqual([]);
    expect(
        await BUILT_IN_CHECKS['postgres/migrations-frozen'].input(
            buildCheckInput(session, 'postgres/migrations-frozen'),
        ),
    ).toStrictEqual([]);
    expect(
        await BUILT_IN_CHECKS['postgres/migration-order'].input(
            buildCheckInput(session, 'postgres/migration-order', { scope: 'apps/api' }),
        ),
    ).toStrictEqual([]);
    expect(
        await BUILT_IN_CHECKS['postgres/migrations-frozen'].input(
            buildCheckInput(session, 'postgres/migrations-frozen', { scope: 'apps/api' }),
        ),
    ).toStrictEqual([]);
    expect(requests).toStrictEqual([rootHash + '\n', childHash + '\n']);
});

test('manifest migration folders retain every owned root and child file while explicit folders stay bounded', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['postgres'], { tables: '[scope.app]\nconfigurations = ["postgres"]\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    for (const scope of ['', 'app'])
        await createFileTree(sandbox.path, {
            [join(scope, 'supabase/migrations/1_first.sql')]: 'CREATE TABLE first_table(id int);',
            [join(scope, 'db/migrations/2_second.sql')]: 'CREATE TABLE second_table(id int);',
            [join(scope, 'migrations/3_third.sql')]: 'CREATE TABLE third_table(id int);',
            [join(scope, 'migrations/4_rollback.down.sql')]: 'invalid SQL;',
            [join(scope, 'custom/5_custom.sql')]: 'CREATE TABLE custom_table(id int);',
            [join(scope, 'custom_extra/6_ignored.sql')]: 'invalid SQL;',
        });
    for (const scope of ['', 'app']) {
        const input = buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order', { scope });
        const migrations = await migrationsOf(input);
        expect(migrations.map(({ name }) => name)).toStrictEqual(['1_first.sql', '2_second.sql', '3_third.sql']);
    }
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        policy + '[postgres]\nmigrations_folder = "custom"\n[scope.app.postgres]\nmigrations_folder = "custom"\n',
    );
    for (const scope of ['', 'app']) {
        const input = buildCheckInput(await openSession(sandbox.path), 'postgres/migration-order', { scope });
        const migrations = await migrationsOf(input);
        expect(migrations.map(({ name }) => name)).toStrictEqual(['5_custom.sql']);
    }
    expect(await Bun.file(join(sandbox.path, 'app/custom_extra/6_ignored.sql')).text()).toBe('invalid SQL;');
});
