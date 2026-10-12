import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { sandboxPath, installToolProjects } from '#tests/setup/install.ts';

import {
    POSTGRES_CASES,
    POSTGRES_SANDBOX,
    UNWRAPPED_MIGRATION,
    SQUAWK_SCOPE_SETTINGS,
    SQUAWK_ROOT_MIGRATION,
    SQUAWK_CHILD_MIGRATION,
} from '#tests/config/postgres.ts';

test("Squawk uses each scope's assume_in_transaction setting, and false under Supabase", async () => {
    await using sandbox = await testdir();

    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['supabase'], {
            tables: SQUAWK_SCOPE_SETTINGS,
        }),
        [SQUAWK_ROOT_MIGRATION]: UNWRAPPED_MIGRATION,
        'transactional/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
        [SQUAWK_CHILD_MIGRATION]: UNWRAPPED_MIGRATION,
    });
    await installToolProjects(sandbox.path);
    const environment = { PATH: sandboxPath() };
    const transactional = await spawnGspot(
        sandbox.path,
        ['check', SQUAWK_CHILD_MIGRATION, '--only', 'postgres/squawk', '--json'],
        environment,
    );
    expect(transactional.code, transactional.stdout + transactional.stderr).toBe(0);
    const command = ['check', SQUAWK_ROOT_MIGRATION, '--only', 'postgres/squawk', '--json'];
    const failed = await spawnGspot(sandbox.path, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toContainEqual(
        containing({ rule: 'prefer-robust-stmts' }),
    );
    await Bun.write(
        join(sandbox.path, SQUAWK_ROOT_MIGRATION),
        UNWRAPPED_MIGRATION.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    );
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

const installedSandbox = shareInstalledSandbox(POSTGRES_SANDBOX);

for (const entry of POSTGRES_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, POSTGRES_SANDBOX);
    });
}
