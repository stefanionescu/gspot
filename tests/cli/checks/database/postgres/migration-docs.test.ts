import { test, expect, describe } from 'bun:test';
import { parseMigration } from '#tests/harness/migrations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { docFindings } from '#cli/checks/database/postgres/migration-docs.ts';

import {
    NAME,
    SECTIONS,
    DOCUMENTED,
    HEADER_FINDINGS,
} from '#tests/config/cli/checks/database/postgres/migration-docs.ts';

const input = {
    check: configurationManifests()
        .get('postgres')!
        .checks.find(({ name }) => name === 'postgres/migration-docs')!,
};

describe('docFindings', () => {
    test('a documented migration has no finding', async () => {
        expect(docFindings(input, await parseMigration(NAME, DOCUMENTED, '20240101000000'), SECTIONS)).toStrictEqual(
            [],
        );
    });

    test('a table under the wrong section with no label has two findings at its line', async () => {
        const moved = DOCUMENTED.replace('-- Table: teams\n-- Purpose: One row for each team.\n', '').replace(
            '-- Tables',
            '-- Indexes',
        );
        const findings = docFindings(input, await parseMigration(NAME, moved, '20240101000000'), SECTIONS);
        expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([
            { rule: 'placement', line: 13 },
            { rule: 'label', line: 13 },
        ]);
        expect(findings[0]?.message).toContain('belongs under "Tables", and it is under "Indexes"');
    });
});

test('migration header and section findings name the line and corrective action', async () => {
    const lines = DOCUMENTED.split('\n');
    lines[0] = '-- wrong separator';
    lines[1] = '-- wrong migration name';
    lines[3] = '-- missing purpose';
    lines[6] = '-- wrong section separator';
    const findings = docFindings(input, await parseMigration(NAME, lines.join('\n'), '20240101000000'), SECTIONS);
    expect(findings.map(({ rule, line, message }) => ({ rule, line, message }))).toStrictEqual(HEADER_FINDINGS);
});
