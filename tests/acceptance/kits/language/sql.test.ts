// Planted repository for the sql configuration: a statement that does not parse, a block comment, a lowercase keyword, a camel-case column.
import { run } from '#tests/harness/cli/command.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { PSQL, SQL_CLEAN } from '#tests/inputs/acceptance/source/kits/kits.ts';

plantedCases(
    'the sql configuration',
    {
        kits: ['sql', 'naming'],
        modules: false,
        without: [],
        tools: ['sqlfluff'],
        files: {
            'db/accounts.sql': SQL_CLEAN,
            'db/report.sql': PSQL,
            'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
        },
        // Init deleted the authored ignore file, so the psql script is left out through the policy.
        prepare: async (root, environment) => {
            const exclusion = { paths: ['db/report.sql'], reason: 'A script for psql, which the linter cannot read.' };
            const excluded = await run(root, ['set', 'tools.sqlfluff.exclude', JSON.stringify(exclusion)], environment);
            if (excluded.code !== 0) throw new Error(`The exclusion was not set: ${excluded.stdout}${excluded.stderr}`);
        },
        corrected: (planted) => ({
            files: Object.fromEntries(Object.keys(planted.files).map((file) => [file, SQL_CLEAN])),
        }),
    },
    [
        {
            check: 'sql/sqlfluff',
            files: { 'db/lower.sql': 'select id from user_accounts;\n' },
            expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
        },
    ],
);
