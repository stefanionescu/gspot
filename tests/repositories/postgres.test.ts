// Planted repository for the postgres preset: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'postgres',
    '--without',
    'naming,structure,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const FOLDER = 'supabase/migrations';
const FIRST = `${FOLDER}/20240101000000_create_teams.sql`;
const TEAMS = `-- The teams of the application.
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON public.teams FOR SELECT USING (true);
`;
const later = (name: string): string => `${FOLDER}/20240201000000_${name}.sql`;
const FROZEN_POLICY = '[tools.squawk]\nfrozen_through = "20240101000000"\n';

const CASES: PlantedCase[] = [
    {
        id: 'postgres/squawk',
        files: { [later('add_size')]: 'ALTER TABLE public.teams ADD COLUMN size INT NOT NULL;\n' },
        expected: 'adding-required-field',
    },
    {
        id: 'postgres/migration-order',
        files: { [`${FOLDER}/20240101000000_second.sql`]: 'SELECT 1;\n' },
        expected: 'already has the version 20240101000000',
    },
    {
        id: 'postgres/migration-order',
        files: { [`${FOLDER}/20230101000000_early.sql`]: 'SELECT 1;\n' },
        expected: 'A new migration sorts before 20240101000000_create_teams.sql',
    },
    {
        id: 'postgres/migrations-frozen',
        files: { [FIRST]: `${TEAMS}SELECT 1;\n` },
        policy: FROZEN_POLICY,
        expected: 'This migration has run, and its text changed',
    },
    {
        id: 'postgres/rls-present',
        files: { [later('create_notes')]: 'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\n' },
        expected: 'public.notes never enables row level security',
    },
    {
        id: 'postgres/rls-present',
        files: {
            [later('create_notes')]:
                'CREATE TABLE IF NOT EXISTS public.notes (id UUID PRIMARY KEY);\nALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n',
        },
        expected: 'no migration gives it a policy',
    },
    {
        id: 'postgres/explicit-grants',
        files: { [later('grant_teams')]: 'GRANT ALL ON public.teams TO anon;\n' },
        expected: 'GRANT ALL gives every privilege',
    },
    {
        id: 'postgres/security-definer-search-path',
        files: {
            [later('create_touch')]:
                'CREATE FUNCTION public.touch() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
        },
        expected: 'sets no search_path',
    },
    {
        id: 'postgres/index-covers-foreign-key',
        files: {
            [later('create_members')]:
                'CREATE TABLE IF NOT EXISTS private.members (\n    id UUID PRIMARY KEY,\n    team_id UUID REFERENCES public.teams (id)\n);\n',
        },
        expected: 'private.members.team_id is a foreign key and no index leads with it',
    },
    {
        id: 'postgres/migration-docs',
        files: {},
        policy: '[tools.postgres]\nmigration_docs = true\n',
        expected: 'The second line is "-- Migration: 20240101000000_create_teams.sql"',
    },
];

describe('the postgres preset', () => {
    test(
        'every postgres check fires on its planted defect',
        async () => {
            await using fixture = await createFixture({ [FIRST]: TEAMS });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['squawk', 'sqlfluff', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            commitAll(fixture.path);
            const checkIds = new Set(CASES.map((planted) => planted.id));
            for (const id of checkIds) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
