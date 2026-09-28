import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { CLI_VERSION } from '#tests/constants/integration/tools/checks.ts';
import { prepareSupabaseDatabase } from '#tests/support/cli/supabase/database.ts';

test('the pinned Supabase CLI generates local database types without changing authored configuration', async () => {
    await using sandbox = await testdir();
    await using database = await prepareSupabaseDatabase(sandbox.path);
    expect(database.version).toBe(CLI_VERSION);
    const generated = await run(['supabase', 'gen', 'types', 'typescript', '--local'], database.options);
    expect(generated.code, generated.stderr).toBe(0);
    expect(generated.stdout).toContain('export type Database');
    expect(readFileSync(database.configPath)).toStrictEqual(database.authored);
}, 600_000);

test('native Supabase freshness rejects drift and accepts regenerated database types', async () => {
    await using sandbox = await testdir();
    await using database = await prepareSupabaseDatabase(sandbox.path);
    const { options, configPath, authored } = database;
    const check = async () =>
        await executeRun(await openSession(sandbox.path), {
            stage: 'push',
            only: ['supabase/types-fresh'],
            skips: [],
            fix: false,
            isDryRun: true,
            noCache: true,
        });
    const stale = await check();
    expect(stale.report.exitCode, JSON.stringify(stale.report)).toBe(1);
    expect(stale.report.checks).toMatchObject([
        {
            check: 'supabase/types-fresh',
            status: 'fail',
            findings: [{ file: 'database.ts', rule: 'types', line: 1 }],
        },
    ]);
    expect(readFileSync(join(sandbox.path, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
    const generated = await run(['supabase', 'gen', 'types', 'typescript', '--local'], options);
    expect(generated.code, generated.stderr).toBe(0);
    expect(generated.stdout).toContain('export type Database');
    await Bun.write(join(sandbox.path, 'database.ts'), generated.stdout);
    const corrected = await check();
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
    expect(readFileSync(configPath)).toStrictEqual(authored);
}, 600_000);
