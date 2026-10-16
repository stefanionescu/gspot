/** Policy statements that distinguish native bucket literals from unrelated source text. */
const STORAGE_POLICIES = [
    {
        name: 'comment only',
        sql: "-- CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars');\n",
        allowed: false,
    },
    {
        name: 'unrelated table',
        sql: "CREATE POLICY p ON public.objects USING (bucket_id = 'avatars');",
        allowed: false,
    },
    {
        name: 'unrelated statement',
        sql: "CREATE POLICY p ON storage.objects USING (true); SELECT 'avatars';",
        allowed: false,
    },
    {
        name: 'quoted identifier',
        sql: 'CREATE POLICY p ON storage.objects USING ("avatars" = bucket_id);',
        allowed: false,
    },
    {
        name: 'quoted relation and literal',
        sql: 'CREATE POLICY p ON "storage"."objects" USING (bucket_id = \'avatars\');',
        allowed: true,
    },
    {
        name: 'with check array',
        sql: "CREATE POLICY p ON storage.objects WITH CHECK (bucket_id = ANY(ARRAY['other', 'avatars']));",
        allowed: true,
    },
] as const;

const SERVICE_KEY_SETTINGS = `configurations = ["supabase"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"

test_files = ["apps/web/qa/**", "apps/web/verification/**"]
`;

const SERVICE_KEY_READERS = {
    'qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'tests/default.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/verification/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
} as const;

/** Secret-key reads and the safe publishable-key replacement for each source. */
const SECRET_KEY_READS = [
    'process.env.SUPABASE_SECRET_KEY',
    'settings.supabase_secret_key',
    'settings.supabaseSecretKey',
    '"sb_secret_example"',
] as const;

const DATABASE_SCHEMAS = ['public', 'private', 'audit'] as const;

/** A native Deno handler shared by Supabase configuration scenarios. */
const HELLO_EDGE_FUNCTION = 'Deno.serve(() => new Response("hello"));\n';

const SUPABASE_SANDBOX = {
    configurations: ['supabase'],

    without: ['typescript'],
    files: {
        'supabase/config.toml': `project_id = "example"

[functions.greet]
verify_jwt = true
`,
        'supabase/functions/greet/index.ts': HELLO_EDGE_FUNCTION,
    },
} as const;

const SUPABASE_CASES = [
    {
        check: 'supabase/deno-lint',
        files: {
            'supabase/functions/greet/index.ts': 'var greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
        },
        expected: { file: 'supabase/functions/greet/index.ts', rule: 'no-var', line: 1 },
        corrected: {
            files: {
                'supabase/functions/greet/index.ts':
                    'const greeting = "hello";\nDeno.serve(() => new Response(greeting));\n',
            },
        },
    },
    {
        check: 'supabase/deno-check',
        files: {
            'supabase/functions/greet/index.ts':
                'const count: number = "one";\nDeno.serve(() => new Response(String(count)));\n',
        },
        expected: { file: 'supabase/functions/greet/index.ts', rule: 'type-error', line: 1 },
        corrected: {
            files: {
                'supabase/functions/greet/index.ts':
                    'const count: number = 1;\nDeno.serve(() => new Response(String(count)));\n',
            },
        },
    },
    {
        check: 'supabase/deno-lint',
        settings: `[[scope]]
path = "apps/api"

configurations = ["supabase"]
`,
        files: {
            'apps/api/supabase/functions/hello/index.ts': 'export function greet(value: any) { return value; }\n',
        },
        expected: { file: 'apps/api/supabase/functions/hello/index.ts', rule: 'no-explicit-any', line: 1 },
        corrected: {
            files: {
                'apps/api/supabase/functions/hello/index.ts':
                    'export function greet(value: string) { return value; }\n',
            },
        },
    },
] as const;

const DOCKER_VERSION_OUTPUT = 'Docker version 29.2.1\n';

const SUPABASE_VERSION_OUTPUT = '2.75.0\n';

const SUPABASE_PROJECT_CONFIG = 'project_id = "types-sample"\n';

export {
    SUPABASE_CASES,
    DATABASE_SCHEMAS,
    SECRET_KEY_READS,
    STORAGE_POLICIES,
    SUPABASE_SANDBOX,
    SERVICE_KEY_READERS,
    SERVICE_KEY_SETTINGS,
    DOCKER_VERSION_OUTPUT,
    SUPABASE_PROJECT_CONFIG,
    SUPABASE_VERSION_OUTPUT,
};
