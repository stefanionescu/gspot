import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { listFindingRows, parseCheckReport, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const UNWRAPPED_MIGRATION_SQL = `SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE public.teams ADD COLUMN size BIGINT;
`;

const SQUAWK_ROOT_MIGRATION_PATH = 'supabase/migrations/0001_initial.sql';

const SQUAWK_CHILD_MIGRATION_PATH = 'transactional/child/supabase/migrations/0001_initial.sql';

const SQUAWK_SCOPE_SETTINGS = `[postgres]
assume_in_transaction = false
[[scope]]
path = "transactional"

[scope.postgres]
assume_in_transaction = true
[[scope]]
path = "transactional/child"

`;

test("Squawk uses each scope's assume_in_transaction setting", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], { tables: SQUAWK_SCOPE_SETTINGS }),
        [SQUAWK_ROOT_MIGRATION_PATH]: UNWRAPPED_MIGRATION_SQL,
        [SQUAWK_CHILD_MIGRATION_PATH]: UNWRAPPED_MIGRATION_SQL,
    });

    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const command = ['check', '--only', 'postgres/squawk', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([
        { file: SQUAWK_ROOT_MIGRATION_PATH, line: 3, rule: 'prefer-robust-stmts' },
    ]);
    await writeFile(
        join(sandbox.path, SQUAWK_ROOT_MIGRATION_PATH),
        UNWRAPPED_MIGRATION_SQL.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    );
    const corrected = await spawnGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
