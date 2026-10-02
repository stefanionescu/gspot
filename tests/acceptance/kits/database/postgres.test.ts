// Planted repository for the postgres configuration: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { commitAll } from '#tests/harness/cli/git.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

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
    ],
);
