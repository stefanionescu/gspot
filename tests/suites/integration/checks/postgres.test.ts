import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, listFindingRows, parseCheckReport, installGeneratedTools } from '#tests/setup/cli/commands.ts';

import {
    SQUAWK_SCOPE_SETTINGS,
    UNWRAPPED_MIGRATION_SQL,
    SQUAWK_ROOT_MIGRATION_PATH,
    SQUAWK_CHILD_MIGRATION_PATH,
} from '#tests/config/integration/checks/postgres.ts';

test("Squawk uses each scope's assume_in_transaction setting", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], { tables: SQUAWK_SCOPE_SETTINGS }),
        [SQUAWK_ROOT_MIGRATION_PATH]: UNWRAPPED_MIGRATION_SQL,
        'transactional/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
        [SQUAWK_CHILD_MIGRATION_PATH]: UNWRAPPED_MIGRATION_SQL,
    });

    await installGeneratedTools(sandbox.path);
    const transactional = await spawnGspot(sandbox.path, [
        'check',
        SQUAWK_CHILD_MIGRATION_PATH,
        '--only',
        'postgres/squawk',
        '--json',
    ]);
    expect(transactional.code, transactional.stdout + transactional.stderr).toBe(0);
    const command = ['check', SQUAWK_ROOT_MIGRATION_PATH, '--only', 'postgres/squawk', '--json'];
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
