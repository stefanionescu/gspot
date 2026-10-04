import { test, expect, describe } from 'bun:test';
import { parseMigration } from '#tests/harness/migrations.ts';
import { docProblems } from '#cli/checks/database/postgres/migration-docs.ts';
import { NAME, SECTIONS, DOCUMENTED } from '#tests/config/cli/checks/database/postgres/migration-docs.ts';

describe('docProblems', () => {
    test('a documented migration has no problem', async () => {
        expect(docProblems(await parseMigration(NAME, DOCUMENTED, '20240101000000'), SECTIONS)).toStrictEqual([]);
    });

    test('a table under the wrong section with no label has two problems at its line', async () => {
        const moved = DOCUMENTED.replace('-- Table: teams\n-- Purpose: One row for each team.\n', '').replace(
            '-- Tables',
            '-- Indexes',
        );
        const problems = docProblems(await parseMigration(NAME, moved, '20240101000000'), SECTIONS);
        expect(problems.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([
            { rule: 'placement', line: 13 },
            { rule: 'label', line: 13 },
        ]);
        expect(problems[0]?.text).toContain('belongs under "Tables", and it is under "Indexes"');
    });
});
