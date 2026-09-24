// Planted repository for the sql configuration: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

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

const CASES: PlantedCase[] = [
    {
        check: 'sql/syntax',
        files: { 'db/broken.sql': `CREATE ${MISSPELLED} user_accounts (id UUID);\n` },
        expected: `syntax error at or near "${MISSPELLED}"`,
    },
    {
        check: 'sql/block-comments',
        files: { 'db/commented.sql': '/* Old. */\nSELECT 1;\n' },
        expected: 'A block comment',
    },
    { check: 'sql/file-length', files: { 'db/long.sql': LONG }, expected: '401 code lines is over the ceiling of 400' },
    { check: 'sql/sqlfluff', files: { 'db/lower.sql': 'select id from user_accounts;\n' }, expected: 'CP01' },
    {
        check: 'naming/identifiers',
        files: { 'db/camel.sql': 'CREATE TABLE audit_entries (\n    "createdAt" TIMESTAMPTZ NOT NULL\n);\n' },
        expected: 'sql column "createdAt"',
    },
];

describe('the sql configuration', () => {
    test(
        'every sql check fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'db/accounts.sql': CLEAN,
                'db/report.sql': PSQL,
                'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const checkIds = new Set(CASES.map((planted) => planted.check));
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
