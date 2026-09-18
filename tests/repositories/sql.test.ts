// Planted repository for the sql preset: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'sql,naming',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    '-- The accounts of the application.\nCREATE TABLE user_accounts (\n    id UUID PRIMARY KEY,\n    display_name TEXT NOT NULL\n);\n';
const LONG = Array.from({ length: 401 }, (_, index) => `SELECT ${String(index)};\n`).join('');

// The keyword arrives in two halves, because the spelling fixer corrects it when it is whole.
const MISSPELLED = ['TAB', 'EL'].join('');

const CASES: PlantedCase[] = [
    {
        id: 'sql/syntax',
        files: { 'db/broken.sql': `CREATE ${MISSPELLED} user_accounts (id UUID);\n` },
        expected: `syntax error at or near "${MISSPELLED}"`,
    },
    { id: 'sql/block-comments', files: { 'db/commented.sql': '/* Old. */\nSELECT 1;\n' }, expected: 'A block comment' },
    { id: 'sql/file-length', files: { 'db/long.sql': LONG }, expected: '401 code lines is over the ceiling of 400' },
    { id: 'sql/sqlfluff', files: { 'db/lower.sql': 'select id from user_accounts;\n' }, expected: 'CP01' },
    {
        id: 'naming/identifiers',
        files: { 'db/camel.sql': 'CREATE TABLE audit_entries (\n    "createdAt" TIMESTAMPTZ NOT NULL\n);\n' },
        expected: 'sql column "createdAt"',
    },
];

describe('the sql preset', () => {
    test(
        'every sql check fires on its planted defect',
        async () => {
            await using fixture = await createFixture({ 'db/accounts.sql': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const checkIds = new Set(CASES.map((planted) => planted.id));
            for (const id of checkIds) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
