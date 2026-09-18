import { tester } from '#plugin-tests/harness/tester.ts';
import { noClientEnvironment } from '#plugin/rules/no-client-environment.ts';

tester().run('no-client-environment', noClientEnvironment, {
    valid: [
        "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
        "'use client';\nconst mode = process.env.NODE_ENV;",
        'const key = process.env.SECRET;',
        "'use client';\nconst process = { env: { SECRET: 1 } };\nconst key = process.env.SECRET;",
        { code: 'const url = process.env.NEXT_PUBLIC_URL;', options: [{ clientModule: true }] },
    ],
    invalid: [
        { code: "'use client';\nconst key = process.env.SECRET;", errors: [{ messageId: 'private' }] },
        { code: "'use client';\nconst { env } = process;", errors: [{ messageId: 'private' }] },
        { code: "'use client';\nconst all = process.env;", errors: [{ messageId: 'private' }] },
        {
            code: 'const key = process.env.SECRET;',
            options: [{ clientModule: true }],
            errors: [{ messageId: 'private' }],
        },
    ],
});
