/** Storage policy statements, and whether each one names a bucket in a real policy and not in other text. */
export const STORAGE_POLICIES = [
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

export const SERVICE_KEY_SETTINGS = `configurations = ["supabase"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"

test_files = ["apps/web/qa/**", "apps/web/verification/**"]
`;

export const SERVICE_KEY_READERS = {
    'qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'tests/default.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/verification/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
} as const;

/** Ways a client file can read the Supabase secret key. */
export const SECRET_KEY_READS = [
    'process.env.SUPABASE_SECRET_KEY',
    'settings.supabase_secret_key',
    'settings.supabaseSecretKey',
    '"sb_secret_example"',
] as const;

/** A Deno handler for the Supabase configuration tests. */
const HELLO_EDGE_FUNCTION = 'Deno.serve(() => new Response("hello"));\n';

export const SUPABASE_SANDBOX = {
    install: false,
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

export const SUPABASE_CASES = [
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

export const INVALID_BUCKETS_CONFIG = '[storage]\nbuckets = "avatars"\n';

export const AVATARS_BUCKET_CONFIG = '[storage.buckets.avatars]\npublic = false\n';

/** The client files that the service-role-key rule reports. */
export const SERVICE_ROLE_CLIENT_FILES = [
    'client.astro',
    'client.cjs',
    'client.cts',
    'client.mts',
    'client.svelte',
    'client.vue',
] as const;

/** Client sources in each component and module kind that read the service role key. */
export const SERVICE_ROLE_CLIENTS = {
    'client.vue': '<script setup>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
    'client.svelte': '<script>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
    'client.astro': '---\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n---\n',
    'client.mts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.cts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.cjs': 'exports.key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'server/allowed.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'notes.txt': 'SUPABASE_SERVICE_ROLE_KEY\n',
} as const;
