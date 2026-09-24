import { describe, expect, test } from 'bun:test';
import type { Migration } from '#cli/checks/postgres/types.ts';
import { DOC_SEPARATOR } from '#cli/checks/postgres/migration-docs.ts';
import { sqlFile } from '#cli/parsers/sql/statements.ts';
import { docProblems } from '#cli/checks/postgres/migration-docs.ts';

const SECTIONS = ['Schema', 'Tables', 'Indexes', 'Functions', 'Triggers', 'Extensions'];
const NAME = '20240101000000_create_teams.sql';

async function migration(text: string): Promise<Migration> {
    const parsed = await sqlFile(text);
    return { path: `migrations/${NAME}`, name: NAME, version: '20240101000000', text, statements: parsed.statements };
}

const DOCUMENTED = [
    DOC_SEPARATOR,
    `-- Migration: ${NAME}`,
    DOC_SEPARATOR,
    '-- Purpose: Creates the teams table.',
    DOC_SEPARATOR,
    '',
    DOC_SEPARATOR,
    '-- Tables',
    DOC_SEPARATOR,
    '',
    DOC_SEPARATOR,
    '-- Table: teams',
    '-- Purpose: One row for each team.',
    DOC_SEPARATOR,
    'CREATE TABLE teams (id UUID PRIMARY KEY);',
    '',
    DOC_SEPARATOR,
    '-- Indexes',
    DOC_SEPARATOR,
    '',
    'CREATE INDEX teams_id_idx ON teams (id);',
    '',
].join('\n');

describe('docProblems', () => {
    test('a documented migration has no problem', async () => {
        expect(docProblems(await migration(DOCUMENTED), SECTIONS)).toEqual([]);
    });

    test('a table under the wrong section with no label has two problems at its line', async () => {
        const moved = DOCUMENTED.replace('-- Table: teams\n-- Purpose: One row for each team.\n', '').replace(
            '-- Tables',
            '-- Indexes',
        );
        const problems = docProblems(await migration(moved), SECTIONS);
        expect(problems.map((problem) => problem.rule)).toEqual(['placement', 'label']);
        expect(problems[0]?.text).toContain('belongs under "Tables", and it is under "Indexes"');
    });
});
