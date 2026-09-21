// Planted repository for the supabase preset: a function with no code, a bucket with no policy, a migration named by hand, a leaked key name.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'supabase',
    '--without',
    'naming',
    'structure',
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

const CASES: PlantedCase[] = [
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': `${CONFIG}\n[functions.missing]\nverify_jwt = true\n` },
        expected: '[functions.missing] configures a function that has no folder',
    },
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': 'project_id = \n' },
        expected: 'supabase/config.toml',
    },
    {
        check: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
        expected: 'The bucket receipts has no policy',
    },
    {
        check: 'supabase/migration-names',
        files: { 'supabase/migrations/002-AddThing.sql': 'SELECT 1;\n' },
        expected: 'fourteen digits',
    },
    {
        check: 'supabase/admin-key-containment',
        files: { 'app/client.ts': `export const key = process.env.${KEY};\n` },
        expected: 'names the service role key',
    },
    {
        check: 'supabase/deno-lint',
        files: {
            'supabase/functions/greet/index.ts': 'var greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
        },
        expected: 'no-var',
    },
    {
        check: 'supabase/deno-check',
        files: {
            'supabase/functions/greet/index.ts':
                'const count: number = "one";\nDeno.serve(() => new Response(String(count)));\n',
        },
        expected: 'TS2322',
    },
];

describe('the supabase preset', () => {
    test(
        'every supabase check fires on its planted defect',
        async () => {
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
            const checkIds = new Set(CASES.map((planted) => planted.check));
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const checked = await run(sandbox.path, ['check', '--stage', 'push', '--json'], environment);
            const atPush = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atPush.checks.map((check) => check.check)).toContain('supabase/types-fresh');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
