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
