// Planted repository for the sql preset: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { createSandbox } from '@gspot/testing';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
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

describe('the sql preset', () => {
    test(
        'every sql check fires on its planted defect',
        async () => {
            await using sandbox = await createSandbox({
                'db/accounts.sql': CLEAN,
                'db/report.sql': PSQL,
                'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
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

describe('gspot apply --baseline', () => {
    test(
        'writes the first baseline of one check, never raises one that exists, and refuses findings a fixer clears',
        async () => {
            await using sandbox = await createSandbox({ 'db/accounts.sql': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            await Bun.write(`${sandbox.path}/db/commented.sql`, '/* Old. */\nSELECT 1;\n');
            commitAll(sandbox.path);
            const before = await run(
                sandbox.path,
                ['check', '--only', 'sql/block-comments', '--no-cache'],
                environment,
            );
            expect(before.code).toBe(1);
            const first = await run(sandbox.path, ['apply', '--baseline', 'sql/block-comments'], environment);
            expect(first.stdout).toContain('baseline: 1 rules of sql/block-comments with 1 findings');
            const held = await run(sandbox.path, ['check', '--only', 'sql/block-comments', '--no-cache'], environment);
            expect(held.code).toBe(0);
            await Bun.write(`${sandbox.path}/db/second.sql`, '/* Older. */\nSELECT 2;\n');
            commitAll(sandbox.path);
            const again = await run(sandbox.path, ['apply', '--baseline', 'sql/block-comments'], environment);
            expect(again.stdout).toContain('has no finding without a baseline');
            const after = await run(sandbox.path, ['check', '--only', 'sql/block-comments', '--no-cache'], environment);
            expect(after.code).toBe(1);
            const layout = await run(sandbox.path, ['apply', '--baseline', 'sql/sqlfluff'], environment);
            expect(layout.code).toBe(2);
            expect(layout.stdout + layout.stderr).toContain('enter no baseline');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
