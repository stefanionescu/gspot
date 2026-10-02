// Planted repository for the postgres configuration: a locking migration, a repeated version, an edited migration, and a schema with holes.
import { commitAll } from '#tests/harness/cli/git.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { FIRST, TEAMS, FOLDER } from '#tests/inputs/acceptance/source/kits/kits.ts';

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
