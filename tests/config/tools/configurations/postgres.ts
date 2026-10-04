import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const FOLDER = 'supabase/migrations';

export const TEAMS = `-- The teams of the application.
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

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['postgres'],
    modules: false,
    tools: ['squawk', 'sqlfluff'],
    files: { [`${FOLDER}/20240101000000_create_teams.sql`]: TEAMS },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'postgres/squawk',
        files: {
            [`${FOLDER}/20240201000000_add_size.sql`]: 'ALTER TABLE public.teams ADD COLUMN size BIGINT NOT NULL;\n',
        },
        expected: { file: `${FOLDER}/20240201000000_add_size.sql`, rule: 'adding-required-field', line: 1 },
        corrected: {
            files: {
                [`${FOLDER}/20240201000000_add_size.sql`]:
                    "BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\nCOMMIT;\n",
            },
        },
    },
];
