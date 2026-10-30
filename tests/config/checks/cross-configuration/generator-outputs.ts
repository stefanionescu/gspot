export const GENERATOR_CASES = [
    {
        configuration: 'openapi',
        check: 'openapi/stale-document',
        output: 'openapi.json',
        tables: `[openapi]
document = "openapi.json"
generate_command = ["bun", "generate.ts", "openapi.json"]
`,
    },
    {
        configuration: 'cloudflare',
        check: 'cloudflare/stale-types',
        output: 'worker-configuration.d.ts',
        tables: '[cloudflare]\ntypes_file = "worker-configuration.d.ts"\n',
    },
    { configuration: 'drizzle', check: 'drizzle/stale-migrations', output: 'migrations/0000_initial.sql', tables: '' },
    {
        configuration: 'supabase',
        check: 'supabase/stale-types',
        output: 'database.ts',
        tables: '[supabase]\ntypes_file = "database.ts"\n',
    },
] as const;

export const DATABASE_SCHEMAS = ['public', 'private', 'audit'] as const;

export const SUPABASE_TYPES_OUTPUT = 'export type Database = { public: { Tables: {} } };\n';

export const UNTRACKED_CLOUDFLARE_FINDINGS = [
    {
        file: 'cloudflare-env.d.ts',
        rule: 'untracked',
        message: 'cloudflare-env.d.ts is not tracked. Commit it, so the other checks and this check can read it.',
    },
] as const;

export const MISSING_OPENAPI_FINDINGS = [
    {
        check: 'openapi/stale-document',
        file: 'openapi.json',
        line: 1,
        rule: 'missing',
        fixable: false,
        help: 'Run the command and commit the document it writes.',
        message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
    },
] as const;

export const CLOUDFLARE_ENV_SOURCE = 'interface CloudflareEnv {}\n';

export const PROJECT_NOTES = 'Keep project notes\n';

export const UNTRACKED_NOTES = 'Keep untracked notes\n';

export const BINARY_OUTPUT_HEX = '00ff8047454e455241544544';
