import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';
import type { ClientEnvOptions } from '#eslint-plugin/types/rules.ts';
import { CLIENT_ENV_SAMPLE, ENVIRONMENT_GLOBALS } from '#tests/data/eslint-plugin.ts';

createRuleTester('/repo').run<
    keyof (typeof plugin.rules)['no-client-env']['meta']['messages'],
    [Partial<ClientEnvOptions[0]>]
>('no-client-env', plugin.rules['no-client-env'], {
    valid: [
        CLIENT_ENV_SAMPLE.corrected,
        "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
        "'use client';\nconst mode = process.env.NODE_ENV;",
        "'use client';\nconst { NODE_ENV } = process.env;",
        { code: 'const url = import.meta.env.VITE_URL;', options: [{ isClient: true, publicPrefixes: ['VITE_'] }] },
        'const key = process.env.SECRET;',
        "'use client';\nconst process = { env: { SECRET: 1 } };\nconst key = process.env.SECRET;",
        { code: 'const url = process.env.NEXT_PUBLIC_URL;', options: [{ isClient: true }] },
        "'use client';\nconst url = process.env['NEXT_PUBLIC_URL'];",
        {
            code: "'use client';\nconst url = process.env['VITE_URL'];\nconst mode = process.env.APP_MODE;",
            options: [{ publicPrefixes: ['VITE_'], allowed: ['APP_MODE'] }],
        },
    ],
    invalid: [
        { code: CLIENT_ENV_SAMPLE.broken, errors: [{ messageId: 'private', line: 2, column: 25 }] },
        { code: "'use client';\nconst key = process.env.SECRET;", errors: [{ messageId: 'private' }] },
        {
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
            options: [{ isClient: true, publicPrefixes: ['VITE_'] }],
            errors: [{ messageId: 'private' }],
        },
        { code: "'use client';\nconst { env } = process;", errors: [{ messageId: 'private' }] },
        { code: "'use client';\nconst all = process.env;", errors: [{ messageId: 'private' }] },
        {
            code: 'const key = process.env.SECRET;',
            options: [{ isClient: true }],
            errors: [{ messageId: 'private' }],
        },
        { code: "'use client';\nconst key = process.env['SECRET'];", errors: [{ messageId: 'private' }] },
        {
            code: "'use client';\nconst name = 'NEXT_PUBLIC_URL';\nconst key = process.env[name];",
            errors: [{ messageId: 'private' }],
        },
        {
            code: "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
            options: [{ publicPrefixes: ['VITE_'] }],
            errors: [{ messageId: 'private' }],
        },
    ],
});
