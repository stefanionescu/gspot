import { GREET } from '#tests/config/samples/supabase.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const SUPABASE_CONFIG = 'project_id = "example"\n\n[functions.greet]\nverify_jwt = true\n';

export const REPOSITORY: InstalledScenario = {
    configurations: ['supabase'],

    without: ['typescript'],
    tools: ['deno'],
    files: {
        'supabase/config.toml': SUPABASE_CONFIG,
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
    {
        check: 'supabase/deno-lint',
        policy: '[scope."apps/api"]\nconfigurations = ["supabase"]\n',
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
];
