import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    POSTGRES_CASES,
    POSTGRES_SANDBOX,
    UNWRAPPED_MIGRATION,
    SQUAWK_ROOT_MIGRATION,
    SQUAWK_SCOPE_SETTINGS,
    SQUAWK_CHILD_MIGRATION,
} from '#tests/data/checks/postgres.ts';

test("Squawk uses each scope's assume_in_transaction setting, and false under Supabase", async () => {
    await using sandbox = await testdir();

    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['supabase'], {
            tables: SQUAWK_SCOPE_SETTINGS,
        }),
        [SQUAWK_ROOT_MIGRATION]: UNWRAPPED_MIGRATION,
        'transactional/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
        [SQUAWK_CHILD_MIGRATION]: UNWRAPPED_MIGRATION,
    });
    await installToolProjects(sandbox.path);
    const environment = { PATH: buildSandboxPath() };
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
        matchFields({ rule: 'prefer-robust-stmts' }),
    );
    await Bun.write(
        join(sandbox.path, SQUAWK_ROOT_MIGRATION),
        UNWRAPPED_MIGRATION.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    );
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

const installedSandbox = registerSharedSandbox(POSTGRES_SANDBOX);

test.each([...POSTGRES_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, POSTGRES_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
