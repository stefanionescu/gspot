import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { UNREADABLE_HISTORY_MESSAGE } from '#tests/config/git.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';
import { NAME_COLUMN_SQL } from '#tests/config/checks/database/postgres/statements.ts';
import { TEAMS_TABLE_SQL, TEAMS_MIGRATION_PATH } from '#tests/config/setup/sandboxes.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { FROZEN_EDIT_MESSAGE, MIGRATION_ORDER_MESSAGE } from '#tests/config/checks/database/postgres/messages.ts';

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
    expect(changed.report.checks.find(({ check }) => check === 'postgres/edited-migrations')?.findings).toStrictEqual([
        {
            check: 'postgres/edited-migrations',
            file: TEAMS_MIGRATION_PATH,
            line: 1,
            rule: 'frozen',
            message: FROZEN_EDIT_MESSAGE,
            fixable: false,
            help: 'Restore the file with `git checkout`, and write the change as a new migration.',
        },
    ]);
    expect(changed.report.checks.find(({ check }) => check === 'postgres/migration-order')?.findings).toStrictEqual([
        {
            check: 'postgres/migration-order',
            file: 'migrations/20240101_early.sql',
            line: 1,
            rule: 'order',
            message: MIGRATION_ORDER_MESSAGE,
            fixable: false,
            help: 'Rename the new migration with a version later than the newest committed one.',
        },
    ]);
});

test('edited-migrations reports an edited committed migration and passes after the edit is undone', async () => {
    await using sandbox = await createMigrationHistory();
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL + NAME_COLUMN_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([
        matchFields({
            file: TEAMS_MIGRATION_PATH,
            line: 1,
            rule: 'frozen',
            message: FROZEN_EDIT_MESSAGE,
        }),
    ]);
    await writeFile(join(sandbox.path, TEAMS_MIGRATION_PATH), TEAMS_TABLE_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/edited-migrations')).toStrictEqual([]);
});

test('edited-migrations fails when it cannot read the committed Git history', async () => {
    await using sandbox = await createMigrationHistory();
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'postgres/edited-migrations');
    await writeFile(join(sandbox.path, '.git', runGitStep(sandbox.path, ['symbolic-ref', 'HEAD'])), 'broken');
    const rejection = await captureRejection(getBuiltInCheck('postgres/edited-migrations')(session, planned));
    expect(rejection.message).toBe(UNREADABLE_HISTORY_MESSAGE);
});
