import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the supabase configuration: a function with no code, a bucket with no policy, a migration named by hand, a leaked key name.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';
import { SUPABASE_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { GREET, MIGRATION, SUPABASE_CONFIG } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const KEY = ['SUPABASE_SERVICE', 'ROLE_KEY'].join('_');

const CASES: FindingCase[] = [
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': `${SUPABASE_CONFIG}\n[functions.missing]\nverify_jwt = true\n` },
        expected: { file: 'supabase/config.toml', rule: 'function', line: 1 },
    },
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': 'project_id = \n' },
        expected: { file: 'supabase/config.toml', rule: 'parse', line: 1 },
    },
    {
        check: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${SUPABASE_CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
        expected: { file: 'supabase/config.toml', rule: 'bucket-policy', line: 1 },
    },
    {
        check: 'supabase/migration-names',
        files: { 'supabase/migrations/002-AddThing.sql': 'SELECT 1;\n' },
        expected: { file: 'supabase/migrations/002-AddThing.sql', rule: 'migration-name', line: 1 },
    },
    {
        check: 'supabase/admin-key-containment',
        files: { 'app/client.ts': `export const key = process.env.${KEY};\n` },
        expected: { file: 'app/client.ts', rule: 'admin-key', line: 1 },
    },
    {
        check: 'supabase/deno-lint',
        files: {
            'supabase/functions/greet/index.ts': 'var greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
        },
        expected: { file: 'supabase/functions/greet/index.ts', rule: 'no-var', line: 1 },
    },
    {
        check: 'supabase/deno-check',
        files: {
            'supabase/functions/greet/index.ts':
                'const count: number = "one";\nDeno.serve(() => new Response(String(count)));\n',
        },
        expected: { file: 'supabase/functions/greet/index.ts', rule: 'deno-check', line: 1 },
    },
];

describe('the supabase configuration', () => {
    test.each(CASES)(
        '$check rejects $expected.rule in $expected.file and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'supabase/config.toml': SUPABASE_CONFIG,
                'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
                'supabase/functions/greet/index.ts': GREET,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['deno', 'squawk', 'sqlfluff', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, SUPABASE_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
            const failedReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failedReport.checks[0]?.findings).toContainEqual(
                containing({ check: planted.check, ...planted.expected }),
            );
            await expectCorrected(sandbox.path, planted.check, environment);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
