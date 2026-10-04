export const DRIZZLE_MIGRATIONS_GENERATOR = String.raw`import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const schema = readFileSync('schema.txt', 'utf8');
if (schema !== 'current') {
    mkdirSync('migrations/meta', { recursive: true });
    writeFileSync('migrations/0001_change.sql', 'ALTER TABLE records ADD name text;\n');
    writeFileSync('migrations/meta/log.json', '{"version":2}\n');
}

if (schema === 'failure') {
    console.error('Migration generation failed');
    process.exitCode = 1;
}
`;

export const DRIZZLE_MIGRATIONS_SCOPES = ['', 'packages/db'];
