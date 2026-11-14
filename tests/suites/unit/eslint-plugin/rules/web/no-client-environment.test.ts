import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { ClientEnvironmentOptions } from '#eslint-plugin/types/security.ts';
import { noClientEnvironment } from '#eslint-plugin/rules/web/no-client-environment.ts';

const ENVIRONMENT_GLOBALS = { process: 'readonly', Bun: 'readonly' } as const;

buildRuleTester().run<keyof (typeof noClientEnvironment)['meta']['messages'], [Partial<ClientEnvironmentOptions[0]>]>(
    'no-client-environment',
    noClientEnvironment,
    {
        valid: [
            {
                code: 'const { MODE, BASE_URL, PROD, DEV, SSR } = import.meta.env;',
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
            "'use client';\nconst url = Deno.env.get('NEXT_PUBLIC_URL');",
            "'use client';\nconst { env } = process;\nconst url = env.NEXT_PUBLIC_URL;",
            "'use client';\nconst { argv } = process;",
            {
                code: "'use client';\nconst { env } = process;\nconst url = env.NEXT_PUBLIC_URL;",
                languageOptions: { globals: ENVIRONMENT_GLOBALS },
            },
            {
                code: "'use client';\nconst url = process.env['VITE_URL'];\nconst mode = process.env.APP_MODE;",
                options: [{ publicPrefixes: ['VITE_'], allowedNames: ['APP_MODE'] }],
            },
        ],
        invalid: [
            {
                code: "'use client';\nconst mode = process.env.MODE;",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                name: 'client directive without declared environment globals',
                code: "'use client';\nconst key = process.env.SECRET;",
                errors: [{ messageId: 'private', line: 2, column: 13, data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                name: 'client directive with declared environment globals',
                code: "'use client';\nconst key = process.env.SECRET;",
                languageOptions: { globals: ENVIRONMENT_GLOBALS },
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst { env: values } = Bun; const key = values.SECRET;",
                languageOptions: { globals: ENVIRONMENT_GLOBALS },
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: 'const key = import.meta.env.SECRET;',
                options: [{ client: true, publicPrefixes: ['VITE_'] }],
                errors: [{ messageId: 'private', data: { public: 'VITE_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst { env } = process;\nconst key = env.SECRET;",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' }, line: 3, column: 13 }],
            },
            {
                code: "'use client';\nconst { env } = process;\nconst key = env.SECRET;",
                languageOptions: { globals: ENVIRONMENT_GLOBALS },
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' }, line: 3, column: 13 }],
            },
            {
                code: "'use client';\nconst { env } = process;\nsend(env);",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst key = Deno.env.get('SECRET');",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst key = Deno.env.get(name);",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst { env: { SECRET } } = process;",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst all = process.env;",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                name: 'private environment value with client option',
                code: 'const key = process.env.SECRET;',
                options: [{ client: true }],
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nfunction read(name) { return process.env[name]; }",
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                name: 'Next public prefix replaced with Vite prefixes',
                code: "'use client';\nconst url = process.env.NEXT_PUBLIC_URL;",
                options: [{ publicPrefixes: ['VITE_'] }],
                errors: [{ messageId: 'private', data: { public: 'VITE_*, NODE_ENV' } }],
            },
            {
                code: "'use client';\nconst host = process;\nconst key = host.env.SECRET;",
                name: 'a private read through an alias of an undeclared process reports',
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: '"use client";\nDeno.env.get();',
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
            {
                code: '"use client";\nconst { ...rest } = process.env;\nrun(rest);',
                errors: [{ messageId: 'private', data: { public: 'NEXT_PUBLIC_*, NODE_ENV' } }],
            },
        ],
    },
);
