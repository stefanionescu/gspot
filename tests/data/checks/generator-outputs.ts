export const GENERATOR_SCRIPT = `import { readFileSync, writeFileSync } from 'node:fs';
const output = process.argv[2];
const state = readFileSync('schema.txt', 'utf8');
writeFileSync(output, state);
console.log(state);
if (state === 'failure') { console.error('Generation failed'); process.exitCode = 1; }
`;

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

export const SUPABASE_TYPES_OUTPUT = 'export type Database = { public: { Tables: {} } };\n';
export const DATABASE_SCHEMAS = ['public', 'private', 'audit'] as const;
export const DOCKER_VERSION_OUTPUT = 'Docker version 29.2.1\n';
export const SUPABASE_VERSION_OUTPUT = '2.75.0\n';
export const SUPABASE_PROJECT_FILE_SOURCE = 'project_id = "types-sample"\n';

/** The finding of an untracked cloudflare-env.d.ts. */
export const UNTRACKED_CLOUDFLARE_FINDINGS = [
    {
        file: 'cloudflare-env.d.ts',
        rule: 'untracked',
        message: 'cloudflare-env.d.ts is not tracked. Commit it, so the other checks and this check can read it.',
    },
] as const;

/** The finding of a missing OpenAPI document. */
export const MISSING_OPENAPI_FINDINGS = [
    {
        file: 'openapi.json',
        rule: 'missing',
        message: 'The file openapi.json does not exist; run bun generate.ts and commit what it writes.',
    },
] as const;
