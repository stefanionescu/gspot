// Planted repository for the postgres preset: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'postgres',
    '--without',
    'naming',
    'structure',
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

const CASES: PlantedCase[] = [
    {
        check: 'postgres/squawk',
        files: { [later('add_size')]: 'ALTER TABLE public.teams ADD COLUMN size INT NOT NULL;\n' },
        expected: 'adding-required-field',
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20240101000000_second.sql`]: 'SELECT 1;\n' },
        expected: 'already has the version 20240101000000',
    },
    {
        check: 'postgres/migration-order',
        files: { [`${FOLDER}/20230101000000_early.sql`]: 'SELECT 1;\n' },
        expected: 'A new migration sorts before 20240101000000_create_teams.sql',
    },
    {
        check: 'postgres/migrations-frozen',
        files: { [FIRST]: `${TEAMS}SELECT 1;\n` },
        policy: FROZEN_POLICY,
        expected: 'This migration has run, and its text changed',
    },
    {
        check: 'postgres/rls-present',
        files: { [later('create_notes')]: 'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\n' },
        expected: 'public.notes never enables row level security',
    },
    {
        check: 'postgres/rls-present',
        files: {
            [later('create_notes')]:
                'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n',
        },
        expected: 'no migration gives it a policy',
    },
    {
        check: 'postgres/explicit-grants',
        files: { [later('grant_teams')]: 'GRANT ALL ON public.teams TO anon;\n' },
        expected: 'GRANT ALL gives every privilege',
    },
    {
        check: 'postgres/security-definer-search-path',
        files: {
            [later('create_touch')]:
                'CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
        },
        expected: 'sets no search_path',
    },
    {
        check: 'postgres/index-covers-foreign-key',
        files: {
            [later('create_members')]:
                'CREATE TABLE IF NOT EXISTS private.members (\n    id UUID PRIMARY KEY,\n    team_id UUID REFERENCES public.teams (id)\n);\n',
        },
        expected: 'private.members.team_id is a foreign key and no index leads with it',
    },
    {
        check: 'postgres/migration-docs',
        files: {},
        policy: '[tools.postgres]\nmigration_docs = true\n',
        expected: 'The second line is "-- Migration: 20240101000000_create_teams.sql"',
    },
];

describe('the postgres preset', () => {
    test(
        'every postgres check fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { [FIRST]: TEAMS });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['squawk', 'sqlfluff', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            commitAll(sandbox.path);
            const checkIds = new Set(CASES.map((planted) => planted.check));
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
