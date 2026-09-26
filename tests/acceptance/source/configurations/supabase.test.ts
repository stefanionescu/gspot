import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the supabase configuration: a function with no code, a bucket with no policy, a migration named by hand, a leaked key name.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'supabase',
    '--without',
    'naming',
    'spelling',
    'typescript',
    'security',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CONFIG =
    'project_id = "planted"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';
const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;
const GREET = 'Deno.serve(() => new Response("hello"));\n';
const KEY = ['SUPABASE_SERVICE', 'ROLE_KEY'].join('_');

const CASES: FindingCase[] = [
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': `${CONFIG}\n[functions.missing]\nverify_jwt = true\n` },
        expected: { file: 'supabase/config.toml', rule: 'function', line: 1 },
    },
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': 'project_id = \n' },
        expected: { file: 'supabase/config.toml', rule: 'parse', line: 1 },
    },
    {
        check: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
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
                'supabase/config.toml': CONFIG,
                'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
                'supabase/functions/greet/index.ts': GREET,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['deno', 'squawk', 'sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
            const failedReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failedReport.checks[0]?.findings).toContainEqual(
                expect.objectContaining({ check: planted.check, ...planted.expected }),
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
