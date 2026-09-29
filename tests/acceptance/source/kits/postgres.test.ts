// Planted repository for the postgres configuration: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { commitAll } from '#tests/support/cli/git.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { FIRST, TEAMS, FOLDER, FROZEN_POLICY } from '#tests/inputs/acceptance/source/kits/kits.ts';

const NOTES = `${FOLDER}/20240201000000_create_notes.sql`;
const NOTES_SECURED =
    'CREATE TABLE public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY notes_read ON public.notes FOR SELECT USING (true);\n';
const DOCUMENTED =
    '-- ============================================================================\n-- Migration: 20240101000000_create_teams.sql\n-- ============================================================================\n-- Purpose: Create teams with restricted row access.\n-- ============================================================================\n-- Tables\n-- ============================================================================\n-- Table: teams\n-- Purpose: Store team names and identities.\n' +
    TEAMS.replace("BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\n", '').replace(
        'COMMIT;\n',
        '',
    );

plantedCases(
    'the postgres configuration',
    {
        kits: ['postgres'],
        modules: false,
        tools: ['squawk', 'sqlfluff'],
        files: { [FIRST]: TEAMS },
        // The frozen check compares migrations with their committed text, so the installed repository is committed.
        prepare: commitAll,
    },
    [
        {
            check: 'postgres/squawk',
            files: {
                [`${FOLDER}/20240201000000_add_size.sql`]:
                    'ALTER TABLE public.teams ADD COLUMN size BIGINT NOT NULL;\n',
            },
            expected: { file: `${FOLDER}/20240201000000_add_size.sql`, rule: 'adding-required-field', line: 1 },
            corrected: {
                files: {
                    [`${FOLDER}/20240201000000_add_size.sql`]:
                        "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\nCOMMIT;\n",
                },
            },
        },
        {
            check: 'postgres/migration-order',
            files: { [`${FOLDER}/20240101000000_second.sql`]: 'SELECT 1;\n' },
            expected: { file: `${FOLDER}/20240101000000_second.sql`, rule: 'duplicate-version', line: 1 },
            corrected: { files: { [`${FOLDER}/20240201000000_second.sql`]: 'SELECT 1;\n' } },
        },
        {
            check: 'postgres/migration-order',
            files: { [`${FOLDER}/20230101000000_early.sql`]: 'SELECT 1;\n' },
            expected: { file: `${FOLDER}/20230101000000_early.sql`, rule: 'order', line: 1 },
            corrected: { files: { [`${FOLDER}/20240201000000_later.sql`]: 'SELECT 1;\n' } },
        },
        {
            check: 'postgres/migrations-frozen',
            files: { [FIRST]: `${TEAMS}SELECT 1;\n` },
            policy: FROZEN_POLICY,
            expected: { file: FIRST, rule: 'frozen', line: 1 },
            corrected: { files: { [FIRST]: TEAMS } },
        },
        {
            check: 'postgres/rls-present',
            files: { [NOTES]: 'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\n' },
            expected: { file: NOTES, rule: 'row-security', line: 1 },
            corrected: { files: { [NOTES]: NOTES_SECURED } },
        },
        {
            check: 'postgres/rls-present',
            files: {
                [NOTES]:
                    'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n',
            },
            expected: { file: NOTES, rule: 'policy', line: 1 },
            corrected: { files: { [NOTES]: NOTES_SECURED } },
        },
        {
            check: 'postgres/explicit-grants',
            files: { [`${FOLDER}/20240201000000_grant_teams.sql`]: 'GRANT ALL ON public.teams TO anon;\n' },
            expected: { file: `${FOLDER}/20240201000000_grant_teams.sql`, rule: 'grant-all', line: 1 },
            corrected: {
                files: { [`${FOLDER}/20240201000000_grant_teams.sql`]: 'GRANT SELECT ON public.teams TO anon;\n' },
            },
        },
        {
            check: 'postgres/security-definer-search-path',
            files: {
                [`${FOLDER}/20240201000000_create_touch.sql`]:
                    'CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
            },
            expected: { file: `${FOLDER}/20240201000000_create_touch.sql`, rule: 'definer-search-path', line: 1 },
            corrected: {
                files: {
                    [`${FOLDER}/20240201000000_create_touch.sql`]:
                        "CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
                },
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
                files: {
                    [`${FOLDER}/20240201000000_create_members.sql`]:
                        'CREATE TABLE private.members (id UUID PRIMARY KEY, team_id UUID REFERENCES public.teams (id));\nCREATE INDEX members_team ON private.members (team_id);\n',
                },
            },
        },
        {
            check: 'postgres/migration-docs',
            files: {},
            policy: '[tools.postgres]\nmigration_docs = true\n',
            expected: { file: FIRST, rule: 'header', line: 2 },
            corrected: { files: { [FIRST]: DOCUMENTED } },
        },
    ],
);
