import { tester } from '#tests/harness/plugin/tester.ts';
import example from '#tests/samples/client-environment.json';
import { noClientEnv } from '#plugin/rules/no-client-env.ts';

tester().run('no-client-env', noClientEnv, {
    valid: [
        example.corrected,
        "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
        "'use client';\nconst mode = process.env.NODE_ENV;",
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
        { code: example.broken, errors: [{ messageId: 'private', line: 2, column: 25 }] },
        { code: "'use client';\nconst key = process.env.SECRET;", errors: [{ messageId: 'private' }] },
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
