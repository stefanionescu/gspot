import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { TEAMS_TABLE_SQL, TEAMS_MIGRATION_PATH } from '#tests/config/checks/database/postgres/history.ts';

test('history: edited-migrations reports an edited committed migration and passes after the edit is undone', async () => {
    await using sandbox = await prepareTeamsHistory();
    await writeFile(
        join(sandbox.path, TEAMS_MIGRATION_PATH),
        TEAMS_TABLE_SQL + 'ALTER TABLE teams ADD COLUMN name text;\n',
    );
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([
        matchFields({
            file: TEAMS_MIGRATION_PATH,
            line: 1,
            rule: 'frozen',
            message:
                'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.',
        }),
    ]);
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});

test('history: migration-order reports a new migration older than a committed one and passes after it is renamed', async () => {
    await using sandbox = await prepareTeamsHistory();
    await writeFile(join(sandbox.path, 'migrations/20240101_early.sql'), 'SELECT 1;\n');
    runGitStep(sandbox.path, ['add', '.']);
    expect(await runSandboxCheck(sandbox.path, 'postgres/migration-order')).toStrictEqual([
        matchFields({
            file: 'migrations/20240101_early.sql',
            line: 1,
            rule: 'order',
            message: 'A new migration sorts before 20240201_teams.sql, which is already committed.',
        }),
    ]);
    runGitStep(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(await runSandboxCheck(sandbox.path, 'postgres/migration-order')).toStrictEqual([]);
});

test('history: edited-migrations fails when it cannot read the committed Git history', async () => {
    await using sandbox = await prepareTeamsHistory();
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'postgres/edited-migrations');
    await writeFile(join(sandbox.path, '.git', runGitStep(sandbox.path, ['symbolic-ref', 'HEAD'])), 'broken');
    expect(await captureRejection(findBuiltInCheck('postgres/edited-migrations')(session, planned))).toBe(
        'Cannot read committed Git history. Restore HEAD and check again.',
    );
});

/**
 * Commit one frozen teams migration.
 *
 * @returns the sandbox, which deletes itself.
 */
async function prepareTeamsHistory(): Promise<AsyncDisposable & { path: string }> {
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        [TEAMS_MIGRATION_PATH]: TEAMS_TABLE_SQL,
    });
    commitAll(sandbox.path);
    return sandbox;
}

test.each(['', 'V'])('history: unpadded %s migration versions replay and freeze in numeric order', async (prefix) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
        [`migrations/${prefix}9_create.sql`]: 'CREATE TABLE teams (id int);',
        [`migrations/${prefix}10_secure.sql`]: 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
    });

    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        [`migrations/${prefix}8_earlier.sql`]: 'SELECT 8;',
        [`migrations/${prefix}11_later.sql`]: 'SELECT 11;',
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'postgres/migration-order');
    const { migrations } = await readMigrations(session, input);
    expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await findBuiltInCheck('postgres/migration-order')(session, input)).toMatchObject([
        { file: `migrations/${prefix}8_earlier.sql`, rule: 'order' },
    ]);
    await writeFile(join(sandbox.path, `migrations/${prefix}10_secure.sql`), 'SELECT 10;');
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
    await writeFile(join(sandbox.path, `migrations/${prefix}9_create.sql`), 'CREATE TABLE teams (id bigint);');
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toMatchObject([
        { file: `migrations/${prefix}9_create.sql`, rule: 'frozen' },
    ]);
});
