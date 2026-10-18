import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { readMigrations } from '#cli/checks/postgres/migrations.ts';
import { MIGRATION_FILE, TEAMS_MIGRATION } from '#tests/data/checks/postgres.ts';
import { checkFindings, buildCheckInput, findBuiltInCheck } from '#tests/setup/check-input.ts';

test('history: migration history reports changed committed SQL and an earlier new version, then passes after fixes', async () => {
    const frozenCheck = findBuiltInCheck('postgres/edited-migrations');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        [MIGRATION_FILE]: TEAMS_MIGRATION,
    });
    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['add', '.']);
    expect(
        await frozenCheck(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations')),
    ).toStrictEqual([]);
    readGitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
    await writeFile(join(sandbox.path, MIGRATION_FILE), TEAMS_MIGRATION + 'ALTER TABLE teams ADD COLUMN name text;\n');
    await createFileTree(sandbox.path, { 'migrations/20240101_early.sql': 'SELECT 1;\n' });
    readGitOutput(sandbox.path, ['add', '.']);
    const frozen = await frozenCheck(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations'));
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
    readGitOutput(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(
        await frozenCheck(buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations')),
    ).toStrictEqual([]);
    expect(await checkFindings(sandbox.path, 'postgres/migration-order')).toStrictEqual([]);
    const read = buildCheckInput(await openSession(sandbox.path), 'postgres/edited-migrations');
    await writeFile(join(sandbox.path, '.git', readGitOutput(sandbox.path, ['symbolic-ref', 'HEAD'])), 'broken');
    expect(await captureRejection(frozenCheck(read))).toContain('Cannot read committed Git history');
});

test.each(['', 'V'])('history: unpadded %s migration versions replay and freeze in numeric order', async (prefix) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "9"\n' }),
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
    const { migrations } = await readMigrations(input);
    expect(migrations.map((migration) => migration.version)).toStrictEqual(['8', '9', '10', '11']);
    expect(buildSchema(migrations).secured.has('public.teams')).toBe(true);
    expect(await findBuiltInCheck('postgres/migration-order')(input)).toMatchObject([
        { file: `migrations/${prefix}8_earlier.sql`, rule: 'order' },
    ]);
    await Bun.write(join(sandbox.path, `migrations/${prefix}10_secure.sql`), 'SELECT 10;');
    expect(await checkFindings(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
    await Bun.write(join(sandbox.path, `migrations/${prefix}9_create.sql`), 'CREATE TABLE teams (id bigint);');
    expect(await checkFindings(sandbox.path, 'postgres/edited-migrations')).toMatchObject([
        { file: `migrations/${prefix}9_create.sql`, rule: 'frozen' },
    ]);
});
