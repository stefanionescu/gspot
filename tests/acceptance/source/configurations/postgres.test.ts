// Planted repository for the postgres configuration: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/cli.ts';
import { toolsPath, installAtLevel } from '#tests/support/cli/tools.ts';
import { POSTGRES_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';

import {
    FIRST,
    TEAMS,
    FOLDER,
    FROZEN_POLICY,
} from '#tests/constants/acceptance/source/configurations/configurations.ts';

const CASES: (FindingCase & { corrected: Record<string, string> })[] = [
    {
        check: 'postgres/squawk',
        files: {
            [`${FOLDER}/20240201000000_add_size.sql`]: 'ALTER TABLE public.teams ADD COLUMN size BIGINT NOT NULL;\n',
        },
        expected: { file: `${FOLDER}/20240201000000_add_size.sql`, rule: 'adding-required-field', line: 1 },
        corrected: {
            [`${FOLDER}/20240201000000_add_size.sql`]:
                "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\nCOMMIT;\n",
        },
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20240101000000_second.sql`]: 'SELECT 1;\n' },
        expected: { file: `${FOLDER}/20240101000000_second.sql`, rule: 'duplicate-version', line: 1 },
        corrected: { [`${FOLDER}/20240201000000_second.sql`]: 'SELECT 1;\n' },
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20230101000000_early.sql`]: 'SELECT 1;\n' },
        expected: { file: `${FOLDER}/20230101000000_early.sql`, rule: 'order', line: 1 },
        corrected: { [`${FOLDER}/20240201000000_later.sql`]: 'SELECT 1;\n' },
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
        files: {
            [`${FOLDER}/20240201000000_create_notes.sql`]:
                'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\n',
        },
        expected: { file: `${FOLDER}/20240201000000_create_notes.sql`, rule: 'row-security', line: 1 },
        corrected: {
            [`${FOLDER}/20240201000000_create_notes.sql`]:
                'CREATE TABLE public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY notes_read ON public.notes FOR SELECT USING (true);\n',
        },
    },
    {
        check: 'postgres/rls-present',
        files: {
            [`${FOLDER}/20240201000000_create_notes.sql`]:
                'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n',
        },
        expected: { file: `${FOLDER}/20240201000000_create_notes.sql`, rule: 'policy', line: 1 },
        corrected: {
            [`${FOLDER}/20240201000000_create_notes.sql`]:
                'CREATE TABLE public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY notes_read ON public.notes FOR SELECT USING (true);\n',
        },
    },
    {
        check: 'postgres/explicit-grants',
        files: { [`${FOLDER}/20240201000000_grant_teams.sql`]: 'GRANT ALL ON public.teams TO anon;\n' },
        expected: { file: `${FOLDER}/20240201000000_grant_teams.sql`, rule: 'grant-all', line: 1 },
        corrected: { [`${FOLDER}/20240201000000_grant_teams.sql`]: 'GRANT SELECT ON public.teams TO anon;\n' },
    },
    {
        check: 'postgres/security-definer-search-path',
        files: {
            [`${FOLDER}/20240201000000_create_touch.sql`]:
                'CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
        },
        expected: { file: `${FOLDER}/20240201000000_create_touch.sql`, rule: 'definer-search-path', line: 1 },
        corrected: {
            [`${FOLDER}/20240201000000_create_touch.sql`]:
                "CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
        },
    },
    {
        check: 'postgres/index-covers-foreign-key',
        files: {
            [`${FOLDER}/20240201000000_create_members.sql`]:
                'CREATE TABLE IF NOT EXISTS private.members (\n    id UUID PRIMARY KEY,\n    team_id UUID REFERENCES public.teams (id)\n);\n',
        },
        // The SQL reader places every finding at the statement, as K-178 says.
        expected: { file: `${FOLDER}/20240201000000_create_members.sql`, rule: 'foreign-key-index', line: 1 },
        corrected: {
            [`${FOLDER}/20240201000000_create_members.sql`]:
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
            await installAtLevel(sandbox.path, POSTGRES_INIT, environment);
            commitAll(sandbox.path);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
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
