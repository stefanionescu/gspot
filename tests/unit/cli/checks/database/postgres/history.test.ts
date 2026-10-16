import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { MIGRATION_FILE, TEAMS_MIGRATION } from '#tests/config/postgres.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

{
    const POSTGRES_HISTORY_POLICY = settingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' });

    test('migration history reports changed committed SQL and an earlier new version, then passes after fixes', async () => {
        const frozenCheck = CHECK_FUNCTIONS['postgres/edited-migrations'];
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': POSTGRES_HISTORY_POLICY,
            [MIGRATION_FILE]: TEAMS_MIGRATION,
        });
        gitOutput(sandbox.path, ['init']);
        gitOutput(sandbox.path, ['add', '.']);
        expect(
            await frozenCheck(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations')),
        ).toStrictEqual([]);
        gitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
        await writeFile(
            join(sandbox.path, MIGRATION_FILE),
            TEAMS_MIGRATION + 'ALTER TABLE teams ADD COLUMN name text;\n',
        );
        await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
        gitOutput(sandbox.path, ['add', '.']);
        const frozen = await frozenCheck(
            buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'),
        );
        expect(frozen).toMatchObject([
            {
                check: 'postgres/edited-migrations',
                file: MIGRATION_FILE,
                line: 1,
                rule: 'frozen',
                fixable: false,
            },
        ]);
        expect(frozen[0]!.message).toContain('postgres.frozen_through');
        const order = await checkFindings(sandbox.path, 'postgres/migration-order');
        expect(order).toMatchObject([
            {
                check: 'postgres/migration-order',
                file: 'migrations/20240101_early.sql',
                line: 1,
                rule: 'order',
                fixable: false,
            },
        ]);
        expect(order[0]!.message).toContain(basename(MIGRATION_FILE));
        await writeFile(join(sandbox.path, MIGRATION_FILE), TEAMS_MIGRATION);
        gitOutput(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
        expect(
            await frozenCheck(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations')),
        ).toStrictEqual([]);
        expect(await checkFindings(sandbox.path, 'postgres/migration-order')).toStrictEqual([]);
        const read = buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations');
        await writeFile(join(sandbox.path, '.git', gitOutput(sandbox.path, ['symbolic-ref', 'HEAD'])), 'broken');
        expect(await rejection(frozenCheck(read))).toContain('Cannot read committed Git history');
    });

    test('nested scopes keep migration roots and parsed reads separate', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['postgres'], {
                tables: '[[scope]]\npath = "apps/one"\nconfigurations = ["postgres"]\n[[scope]]\npath = "apps/two"\nconfigurations = ["postgres"]\n[scope.postgres]\nmigrations_folder = "apps/two/schema"\n',
            }),
            [MIGRATION_FILE]: TEAMS_MIGRATION,
            'apps/one/migrations/20240101_one.sql': 'SELECT 1;\n',
            'apps/two/schema/20240101_two.sql': 'SELECT 2;\n',
        });
        const session = await openSession(sandbox.path);
        const expected: Record<string, string> = {
            '': MIGRATION_FILE,
            'apps/one': 'apps/one/migrations/20240101_one.sql',
            'apps/two': 'apps/two/schema/20240101_two.sql',
        };
        for (const selected of session.scopes) {
            const scopeInput = buildCheckInput(session, 'postgres/migration-order', { scope: selected.scope.path });
            const migrations = await readMigrations(scopeInput);
            expect(migrations.map((migration) => migration.path)).toStrictEqual([expected[selected.scope.path]!]);
            expect(await CHECK_FUNCTIONS['postgres/migration-order'](scopeInput)).toStrictEqual([]);
        }
    });

    test.each(['', 'V'])('unpadded %s migration versions replay and freeze in numeric order', async (prefix) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
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
        const migrations = await readMigrations(input);
        expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
        expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
        expect(await CHECK_FUNCTIONS['postgres/migration-order'](input)).toMatchObject([
            { file: `migrations/${prefix}8_earlier.sql`, rule: 'order' },
        ]);
        await Bun.write(join(sandbox.path, `migrations/${prefix}10_secure.sql`), 'SELECT 10;');
        expect(await checkFindings(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
        await Bun.write(join(sandbox.path, `migrations/${prefix}9_create.sql`), 'CREATE TABLE teams (id bigint);');
        expect(await checkFindings(sandbox.path, 'postgres/edited-migrations')).toMatchObject([
            { file: `migrations/${prefix}9_create.sql`, rule: 'frozen' },
        ]);
    });

    test('history reads only selected migration blobs and shares reads without mixing scopes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['postgres'], {
                tables: '[postgres]\nfrozen_through = "all"\n[[scope]]\npath = "apps/api"\nconfigurations = ["postgres"]\npostgres.migrations_folder = "apps/api/migrations"\n',
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
        const nativeRun = processes.streamProcess;
        using _stream = spyOn(processes, 'streamProcess').mockImplementation((argv, options, output) => {
            if (argv[0] === 'git' && argv[1] === 'cat-file') requests.push(options.stdin!);
            return nativeRun(argv, options, output);
        });
        expect(
            await CHECK_FUNCTIONS['postgres/migration-order'](buildCheckInput(session, 'postgres/migration-order')),
        ).toStrictEqual([]);
        expect(
            await CHECK_FUNCTIONS['postgres/edited-migrations'](buildCheckInput(session, 'postgres/edited-migrations')),
        ).toStrictEqual([]);
        expect(
            await CHECK_FUNCTIONS['postgres/migration-order'](
                buildCheckInput(session, 'postgres/migration-order', { scope: 'apps/api' }),
            ),
        ).toStrictEqual([]);
        expect(
            await CHECK_FUNCTIONS['postgres/edited-migrations'](
                buildCheckInput(session, 'postgres/edited-migrations', { scope: 'apps/api' }),
            ),
        ).toStrictEqual([]);
        expect(requests).toStrictEqual([rootHash + '\n', childHash + '\n']);
    });
}
