import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
// Planted repository for the sql configuration: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { PLANTED_TIMEOUT_MS } from '#tests/support/cli/command.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'sql',
    'naming',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    '-- The accounts of the application.\nCREATE TABLE user_accounts (\n    id UUID PRIMARY KEY,\n    display_name TEXT NOT NULL\n);\n';
// A script for psql: a meta-command and two kinds of variable, which the server never sees.
const PSQL = "\\set team 'core'\nSELECT id FROM user_accounts WHERE display_name = :'team' AND id = :account_id;\n";
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
                'db/accounts.sql': CLEAN,
                'db/report.sql': PSQL,
                'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, INIT, environment);
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
                Object.fromEntries(Object.keys(planted.files).map((file) => [file, CLEAN])),
            );
            await expectCorrected(sandbox.path, planted.check, environment);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
