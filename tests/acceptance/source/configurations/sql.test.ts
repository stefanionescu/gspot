import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the sql configuration: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';
import { SQL_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { PSQL, SQL_CLEAN } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const LONG = Array.from({ length: 401 }, (_, index) => `SELECT ${String(index)};\n`).join('');

// The keyword arrives in two halves, because the spelling fixer corrects it when it is whole.
const MISSPELLED = ['TAB', 'EL'].join('');

const CASES: FindingCase[] = [
    {
        check: 'sql/syntax',
        files: { 'db/broken.sql': `CREATE ${MISSPELLED} user_accounts (id UUID);\n` },
        expected: { file: 'db/broken.sql', rule: 'syntax', line: 1 },
    },
    {
        check: 'sql/block-comments',
        files: { 'db/commented.sql': '/* Old. */\nSELECT 1;\n' },
        expected: { file: 'db/commented.sql', rule: 'block-comment', line: 1 },
    },
    {
        check: 'sql/file-length',
        files: { 'db/long.sql': LONG },
        expected: { file: 'db/long.sql', rule: 'file-lines', line: 1 },
    },
    {
        check: 'sql/sqlfluff',
        files: { 'db/lower.sql': 'select id from user_accounts;\n' },
        expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
    },
    {
        check: 'naming/identifiers',
        files: { 'db/camel.sql': 'CREATE TABLE audit_entries (\n    "createdAt" TIMESTAMPTZ NOT NULL\n);\n' },
        expected: { file: 'db/camel.sql', rule: 'case', line: 2 },
    },
];

describe('the sql configuration', () => {
    test.each(CASES)(
        '$check rejects $expected.rule in $expected.file and accepts corrected SQL',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'db/accounts.sql': SQL_CLEAN,
                'db/report.sql': PSQL,
                'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, SQL_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failedReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failedReport.checks[0]?.findings).toContainEqual(
                containing({ check: planted.check, ...planted.expected }),
            );
            await createFileTree(
                sandbox.path,
                Object.fromEntries(Object.keys(planted.files).map((file) => [file, SQL_CLEAN])),
            );
            await expectCorrected(sandbox.path, planted.check, environment);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
