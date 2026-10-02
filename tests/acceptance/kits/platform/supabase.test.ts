// The Deno checks of the Supabase kit on an installed project: each fires on its defect and accepts the correction.
import { plantedCases } from '#tests/harness/planted/cases.ts';

const SUPABASE_CONFIG =
    'project_id = "planted"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;

const GREET = 'Deno.serve(() => new Response("hello"));\n';

plantedCases(
    'the supabase configuration',
    {
        kits: ['supabase'],
        modules: false,
        without: ['naming', 'spelling', 'typescript', 'security'],
        tools: ['deno', 'squawk', 'sqlfluff'],
        files: {
            'supabase/config.toml': SUPABASE_CONFIG,
            'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
            'supabase/functions/greet/index.ts': GREET,
        },
    },
    [
        {
            check: 'supabase/deno-lint',
            files: {
                'supabase/functions/greet/index.ts':
                    'var greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
            },
            expected: { file: 'supabase/functions/greet/index.ts', rule: 'no-var', line: 1 },
        },
        {
            check: 'supabase/deno-check',
            files: {
                'supabase/functions/greet/index.ts':
                    'const count: number = "one";\nDeno.serve(() => new Response(String(count)));\n',
            },
            expected: { file: 'supabase/functions/greet/index.ts', rule: 'type-error', line: 1 },
        },
    ],
);
