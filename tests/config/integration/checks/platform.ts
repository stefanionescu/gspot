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
] as const;
