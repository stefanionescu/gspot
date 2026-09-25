import { join } from 'node:path';
import { reportSchema } from '#cli/execution/report.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the postgres configuration: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'postgres',
    '--without',
    'naming',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const FOLDER = 'supabase/migrations';
const FIRST = `${FOLDER}/20240101000000_create_teams.sql`;
const TEAMS = `-- The teams of the application.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON public.teams FOR SELECT USING (true);
COMMIT;
`;
const later = (name: string): string => `${FOLDER}/20240201000000_${name}.sql`;
const FROZEN_POLICY = '[tools.squawk]\nfrozen_through = "20240101000000"\n';

const CASES: (FindingCase & { corrected: Record<string, string> })[] = [
    {
        check: 'postgres/squawk',
        files: { [later('add_size')]: 'ALTER TABLE public.teams ADD COLUMN size INT NOT NULL;\n' },
        expected: { file: later('add_size'), rule: 'adding-required-field', line: 1 },
        corrected: {
            [later('add_size')]:
                "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size INT;\nCOMMIT;\n",
        },
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20240101000000_second.sql`]: 'SELECT 1;\n' },
        expected: { file: `${FOLDER}/20240101000000_second.sql`, rule: 'duplicate-version', line: 1 },
        corrected: { [later('second')]: 'SELECT 1;\n' },
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20230101000000_early.sql`]: 'SELECT 1;\n' },
        expected: { file: `${FOLDER}/20230101000000_early.sql`, rule: 'order', line: 1 },
        corrected: { [later('later')]: 'SELECT 1;\n' },
    },
    {
        check: 'postgres/migrations-frozen',
        files: { [FIRST]: `${TEAMS}SELECT 1;\n` },
        policy: FROZEN_POLICY,
        expected: { file: FIRST, rule: 'frozen', line: 1 },
        corrected: { [FIRST]: TEAMS },
    },
    {
        check: 'postgres/rls-present',
        files: { [later('create_notes')]: 'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\n' },
        expected: { file: later('create_notes'), rule: 'row-security', line: 1 },
        corrected: {
            [later('create_notes')]:
                'CREATE TABLE public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY notes_read ON public.notes FOR SELECT USING (true);\n',
        },
    },
    {
        check: 'postgres/rls-present',
        files: {
            [later('create_notes')]:
                'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n',
        },
        expected: { file: later('create_notes'), rule: 'policy', line: 1 },
        corrected: {
            [later('create_notes')]:
                'CREATE TABLE public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY notes_read ON public.notes FOR SELECT USING (true);\n',
        },
    },
    {
        check: 'postgres/explicit-grants',
        files: { [later('grant_teams')]: 'GRANT ALL ON public.teams TO anon;\n' },
        expected: { file: later('grant_teams'), rule: 'grant-all', line: 1 },
        corrected: { [later('grant_teams')]: 'GRANT SELECT ON public.teams TO anon;\n' },
    },
    {
        check: 'postgres/security-definer-search-path',
        files: {
            [later('create_touch')]:
                'CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
        },
        expected: { file: later('create_touch'), rule: 'search_path', line: 1 },
        corrected: {
            [later('create_touch')]:
                "CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
        },
    },
    {
        check: 'postgres/index-covers-foreign-key',
        files: {
            [later('create_members')]:
                'CREATE TABLE IF NOT EXISTS private.members (\n    id UUID PRIMARY KEY,\n    team_id UUID REFERENCES public.teams (id)\n);\n',
        },
        expected: { file: later('create_members'), rule: 'foreign-key-index', line: 3 },
        corrected: {
            [later('create_members')]:
                'CREATE TABLE private.members (id UUID PRIMARY KEY, team_id UUID REFERENCES public.teams (id));\nCREATE INDEX members_team ON private.members (team_id);\n',
        },
    },
    {
        check: 'postgres/migration-docs',
        files: {},
        policy: '[tools.postgres]\nmigration_docs = true\n',
        expected: { file: FIRST, rule: 'header', line: 2 },
        corrected: {
            [FIRST]:
                '-- ============================================================================\n-- Migration: 20240101000000_create_teams.sql\n-- ============================================================================\n-- Purpose: Create teams with restricted row access.\n-- ============================================================================\n-- Tables\n-- ============================================================================\n-- Table: teams\n-- Purpose: Store team names and identities.\n' +
                TEAMS.replace(
                    "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\n",
                    '',
                ).replace('COMMIT;\n', ''),
        },
    },
];

describe('the postgres configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts corrected migrations',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { [FIRST]: TEAMS });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['squawk', 'sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            commitAll(sandbox.path);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            const corrected = await runPlanted(sandbox.path, { ...planted, files: planted.corrected }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
