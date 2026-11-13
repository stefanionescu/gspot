import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { TEAMS_MIGRATION_PATH, TEAMS_TABLE_SQL } from '#tests/config/setup/sandboxes.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox, createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

const NAME_COLUMN_SQL = 'ALTER TABLE teams ADD COLUMN name text;\n';

test('edited-migrations compares committed migration changes with the selected base revision', async () => {
    await using sandbox = await createMigrationHistory();
    const base = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL + NAME_COLUMN_SQL);
    commitAll(sandbox.path, 'edit');
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'postgres/edited-migrations');
    expect(await getBuiltInCheck('postgres/edited-migrations')(session, planned)).toStrictEqual([]);
    const changed = await getBuiltInCheck('postgres/edited-migrations', { content: 'working-tree', base })(
        session,
        planned,
    );
    expect(changed.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: TEAMS_MIGRATION_PATH, rule: 'frozen' },
    ]);
});

test('edited-migrations reports an edited committed migration', async () => {
    await using sandbox = await createMigrationHistory();
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL + NAME_COLUMN_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([
        matchFields({ file: TEAMS_MIGRATION_PATH, line: 1, rule: 'frozen' }),
    ]);
});

test.each([
    'CREATE TABLE IF NOT EXISTS teams (id int);',
    'CREATE INDEX IF NOT EXISTS team_index ON teams (id);',
    'ALTER TABLE teams ADD COLUMN IF NOT EXISTS name text;',
])('edited-migrations reports the drift guard of %s', async (statement) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/1_tables.sql': `${statement}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/edited-migrations');
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'drift-guard', line: 1 }]);
});

test('edited-migrations accepts IF NOT EXISTS on CREATE INDEX CONCURRENTLY', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/1_tables.sql': 'CREATE TABLE teams (id int);\n',
        'migrations/2_index.sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS team_index ON teams (id);\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});

test('a drift guard in a frozen migration is not reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "1"\n' }),
        'migrations/1_t.sql': 'CREATE TABLE IF NOT EXISTS teams (id int);\n',
        'migrations/2_i.sql': 'CREATE TABLE IF NOT EXISTS members (id int);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/edited-migrations');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'migrations/2_i.sql', rule: 'drift-guard' },
    ]);
});

test('an edit below migrate:down of a committed migration is not reported', async () => {
    await using sandbox = await createMigrationHistory();
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), `${TEAMS_TABLE_SQL}-- migrate:down\nDROP TABLE teams;\n`);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});
