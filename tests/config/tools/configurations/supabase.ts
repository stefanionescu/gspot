import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const SUPABASE_CONFIG =
    'project_id = "example"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

export const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;

export const GREET = 'Deno.serve(() => new Response("hello"));\n';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['supabase'],
    modules: false,
    without: ['typescript'],
    tools: ['deno', 'squawk', 'sqlfluff'],
    files: {
        'supabase/config.toml': SUPABASE_CONFIG,
        'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
        'supabase/functions/greet/index.ts': GREET,
    },
};

export const CASES: FindingCase[] = [
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
        expected: { file: 'supabase/functions/greet/index.ts', rule: 'type-error', line: 1 },
    },
];
