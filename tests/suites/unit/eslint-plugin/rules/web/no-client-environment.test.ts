import plugin from '#eslint-plugin/plugin.ts';
import { ENVIRONMENT_GLOBALS } from '#tests/config/eslint-plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { ClientEnvironmentOptions } from '#eslint-plugin/types/security.ts';

buildRuleTester().run<
    keyof (typeof plugin.rules)['no-client-environment']['meta']['messages'],
    [Partial<ClientEnvironmentOptions[0]>]
>('no-client-environment', plugin.rules['no-client-environment'], {
    valid: [
        'log(process);',
        'const { argv } = process;',

        {
            code: 'const { MODE, BASE_URL, PROD, DEV, SSR } = import.meta.env;',
            options: [{ client: true, publicPrefixes: ['VITE_'] }],
        },
        {
            code: 'if (import.meta.env.DEV) console.log(import.meta.env.MODE);',
            options: [{ client: true, publicPrefixes: ['VITE_'] }],
        },
        {
            name: 'Next public prefix allowed by default',
            code: "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
        },
        "'use client';\nconst mode = process.env.NODE_ENV;",
        "'use client';\nconst { NODE_ENV } = process.env;",
        { code: 'const url = import.meta.env.VITE_URL;', options: [{ client: true, publicPrefixes: ['VITE_'] }] },
        { name: 'private environment value outside a client module', code: 'const key = process.env.SECRET;' },
        "'use client';\nconst process = { env: { SECRET: 1 } };\nconst key = process.env.SECRET;",
        { code: 'const url = process.env.NEXT_PUBLIC_URL;', options: [{ client: true }] },
        "'use client';\nconst url = process.env['NEXT_PUBLIC_URL'];",
        "'use client';\nconst url = Deno.env.get('NEXT_PUBLIC_URL');",
        "'use client';\nconst { env } = process;\nconst url = env.NEXT_PUBLIC_URL;",
        "'use client';\nconst { env } = process;",
        {
            code: "'use client';\nconst url = process.env['VITE_URL'];\nconst mode = process.env.APP_MODE;",
            options: [{ publicPrefixes: ['VITE_'], allowedNames: ['APP_MODE'] }],
        },
    ],
    invalid: [
        {
            code: "'use client';\nconst mode = process.env.MODE;",
            errors: [{ messageId: 'private' }],
        },
        {
            name: 'client directive without declared environment globals',
            code: "'use client';\nconst key = process.env.SECRET;",
            errors: [{ messageId: 'private', line: 2, column: 13 }],
        },
        {
            name: 'client directive with declared environment globals',
            code: "'use client';\nconst key = process.env.SECRET;",
            languageOptions: { globals: ENVIRONMENT_GLOBALS },
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst host = process; const key = host.env.SECRET;",
            languageOptions: { globals: ENVIRONMENT_GLOBALS },
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst { env: values } = Bun; const key = values.SECRET;",
            languageOptions: { globals: ENVIRONMENT_GLOBALS },
            errors: [{ messageId: 'private' }],
        },
        {
            code: 'const key = import.meta.env.SECRET;',
            options: [{ client: true, publicPrefixes: ['VITE_'] }],
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst { env } = process;\nconst key = env.SECRET;",
            errors: [{ messageId: 'private', line: 3, column: 13 }],
        },
        { code: "'use client';\nconst { env } = process;\nsend(env);", errors: [{ messageId: 'private' }] },
        { code: "'use client';\nconst key = Deno.env.get('SECRET');", errors: [{ messageId: 'private' }] },
        {
            code: "'use client';\nconst key = Deno.env.get(name);",
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst { env: { SECRET } } = process;",
            errors: [{ messageId: 'private' }],
        },
        { code: "'use client';\nconst all = process.env;", errors: [{ messageId: 'private' }] },
        {
            name: 'private environment value with client option',
            code: 'const key = process.env.SECRET;',
            options: [{ client: true }],
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst name = 'NEXT_PUBLIC_URL';\nconst key = process.env[name];",
            errors: [{ messageId: 'private' }],
        },
        {
            name: 'Next public prefix replaced with Vite prefixes',
            code: "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
            options: [{ publicPrefixes: ['VITE_'] }],
            errors: [{ messageId: 'private' }],
        },
    ],
});

buildRuleTester().run('no-client-environment regressions', plugin.rules['no-client-environment'], {
    valid: [],
    invalid: [
        {
            code: "'use client';\nconst host = process;\nconst key = host.env.SECRET;",
            name: 'a private read through an alias of an undeclared process reports',
            errors: [{ messageId: 'private' }],
        },
        { code: '"use client";\nDeno.env.get();', errors: [{ messageId: 'private' }] },
        { code: '"use client";\nconst { ...rest } = process.env;\nrun(rest);', errors: [{ messageId: 'private' }] },
    ],
});
