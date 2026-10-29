import plugin from '#eslint-plugin/plugin.ts';
import type { ClientEnvOptions } from '#eslint-plugin/types/rules.ts';
import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { ENVIRONMENT_GLOBALS } from '#tests/config/eslint-plugin/no-client-env.ts';

createRuleTester().run<
    keyof (typeof plugin.rules)['no-client-env']['meta']['messages'],
    [Partial<ClientEnvOptions[0]>]
>('no-client-env', plugin.rules['no-client-env'], {
    valid: [
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
        { code: "'use client';\nconst { env } = process;", errors: [{ messageId: 'private' }] },
        { code: "'use client';\nconst all = process.env;", errors: [{ messageId: 'private' }] },
        {
            name: 'private environment value with client option',
            code: 'const key = process.env.SECRET;',
            options: [{ client: true }],
            errors: [{ messageId: 'private' }],
        },
        { code: "'use client';\nconst key = process.env['SECRET'];", errors: [{ messageId: 'private' }] },
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

createRuleTester().run('no-client-env regressions', plugin.rules['no-client-env'], {
    valid: [],
    invalid: [
        {
            code: "'use client';\nconst host = process;\nconst key = host.env.SECRET;",
            name: 'a private read through an alias of an undeclared process reports',
            errors: [{ messageId: 'private' }],
        },
    ],
});
