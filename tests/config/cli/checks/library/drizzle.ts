import type { FindingCase } from '#tests/types/harness/check-case.ts';

export const DRIZZLE_MIGRATIONS_GENERATOR = String.raw`import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const schema = readFileSync('schema.txt', 'utf8');
if (schema !== 'current') {
    mkdirSync('migrations/meta', { recursive: true });
    mkdirSync('migrations/.meta', { recursive: true });
    writeFileSync('migrations/0001_change.sql', 'ALTER TABLE records ADD name text;\n');
    writeFileSync('migrations/meta/log.json', '{"version":2}\n');
    writeFileSync('migrations/.meta/state.json', '{"version":2}\n');
}

if (schema === 'failure') {
    console.error('Migration generation failed');
    process.exitCode = 1;
}
`;

export const DRIZZLE_MIGRATIONS_SCOPES = ['', 'packages/db'];

export const TABLES = `// A test file.\n\nimport { uuid, pgTable } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n`;

export const DRIZZLE_RELATIONS_CASES: FindingCase[] = [
    {
        check: 'drizzle/relations',
        files: { 'src/tables.ts': TABLES },
        expected: { file: 'src/tables.ts', rule: 'relations', line: 9 },
        corrected: {
            files: {
                'src/tables.ts': `${TABLES}\nimport { relations } from "drizzle-orm";\nexport const memberRelations = relations(members, ({one}) => ({ team: one(teams, {fields: [members.teamId], references: [teams.id]}) }));\n`,
            },
        },
    },
];
