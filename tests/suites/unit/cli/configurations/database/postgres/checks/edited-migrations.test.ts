import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { NAME_COLUMN_SQL } from '#tests/config/configurations/database.ts';
import { TEAMS_TABLE_SQL, TEAMS_MIGRATION_PATH } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox, createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';

test('history checks compare committed migration changes with the selected base revision', async () => {
    await using sandbox = await createMigrationHistory();
    const base = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await createFileTree(sandbox.path, {
        [TEAMS_MIGRATION_PATH]: TEAMS_TABLE_SQL + NAME_COLUMN_SQL,
        'migrations/20240101_early.sql': 'SELECT 1;\n',
    });
    commitAll(sandbox.path, 'edit');
    const session = await openSession(sandbox.path);
    const only = ['postgres/edited-migrations', 'postgres/migration-order'];
    const initial = await runChecks(session, buildRunOptions({ only }));
    expect(initial.report.checks.flatMap((result) => result.findings)).toStrictEqual([]);
    const changed = await runChecks(session, buildRunOptions({ only, selection: { content: 'working-tree', base } }));
    expect(
        changed.report.checks
            .find(({ check }) => check === 'postgres/edited-migrations')
            ?.findings.map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([{ file: TEAMS_MIGRATION_PATH, rule: 'frozen' }]);
    expect(
        changed.report.checks
            .find(({ check }) => check === 'postgres/migration-order')
            ?.findings.map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([{ file: 'migrations/20240101_early.sql', rule: 'order' }]);
});

test('edited-migrations reports an edited committed migration and passes after the edit is undone', async () => {
    await using sandbox = await createMigrationHistory();
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL + NAME_COLUMN_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([
        matchFields({
            file: TEAMS_MIGRATION_PATH,
            line: 1,
            rule: 'frozen',
        }),
    ]);
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});

test.each([
    'CREATE TABLE IF NOT EXISTS teams (id int);',
    'CREATE INDEX IF NOT EXISTS team_index ON teams (id);',
    'ALTER TABLE teams ADD COLUMN IF NOT EXISTS name text;',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
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
        'gspot.toml': buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "1"\n' }),
        'migrations/1_tables.sql': 'CREATE TABLE teams (id int);\n',
        'migrations/2_index.sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS team_index ON teams (id);\n',
    });
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});
