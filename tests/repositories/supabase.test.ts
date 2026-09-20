// Planted repository for the supabase preset: a function with no code, a bucket with no policy, a migration named by hand, a leaked key name.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'supabase',
    '--without',
    'naming,structure,spelling,typescript,security',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
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
        id: 'supabase/config',
        files: { 'supabase/config.toml': `${CONFIG}\n[functions.missing]\nverify_jwt = true\n` },
        expected: '[functions.missing] configures a function that has no folder',
    },
    { id: 'supabase/config', files: { 'supabase/config.toml': 'project_id = \n' }, expected: 'supabase/config.toml' },
    {
        id: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
        expected: 'The bucket receipts has no policy',
    },
    {
        id: 'supabase/migration-names',
        files: { 'supabase/migrations/002-AddThing.sql': 'SELECT 1;\n' },
        expected: 'fourteen digits',
    },
    {
        id: 'supabase/admin-key-containment',
        files: { 'app/client.ts': `export const key = process.env.${KEY};\n` },
        expected: 'names the service role key',
    },
    {
        id: 'supabase/deno-lint',
        files: {
            'supabase/functions/greet/index.ts': 'var greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
        },
        expected: 'no-var',
    },
    {
        id: 'supabase/deno-check',
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
            await using fixture = await createFixture({
                'supabase/config.toml': CONFIG,
                'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
                'supabase/functions/greet/index.ts': GREET,
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['deno', 'squawk', 'sqlfluff', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const checkIds = new Set(CASES.map((planted) => planted.id));
            for (const id of checkIds) {
                const clean = await run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            const checked = await run(fixture.path, ['check', '--at', 'push', '--json'], environment);
            const atPush = JSON.parse(checked.stdout) as {
                checks: { id: string }[];
            };
            expect(atPush.checks.map((check) => check.id)).toContain('supabase/types-fresh');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
