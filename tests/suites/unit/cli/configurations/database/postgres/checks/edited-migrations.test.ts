import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';
import { NAME_COLUMN_SQL } from '#tests/config/checks/database/postgres/statements.ts';
import { TEAMS_TABLE_SQL, TEAMS_MIGRATION_PATH } from '#tests/config/setup/sandboxes.ts';

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
    const changed = await runChecks(session, buildRunOptions({ only, base }));
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
