// The built-in Supabase checks on a planted project, run in-process: each fires on its defect and accepts the correction.
import { plantedCases } from '#tests/harness/planted/cases.ts';

const SUPABASE_CONFIG =
    'project_id = "planted"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;

const GREET = 'Deno.serve(() => new Response("hello"));\n';
const KEY = ['SUPABASE_SERVICE', 'ROLE_KEY'].join('_');

plantedCases(
    'the built-in supabase checks',
    {
        kits: ['supabase'],
        modules: false,
        installs: false,
        files: {
            'supabase/config.toml': SUPABASE_CONFIG,
            'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
            'supabase/functions/greet/index.ts': GREET,
        },
    },
    [
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
            check: 'supabase/admin-key',
            files: { 'app/client.ts': `export const key = process.env.${KEY};\n` },
            expected: { file: 'app/client.ts', rule: 'admin-key', line: 1 },
        },
    ],
);
