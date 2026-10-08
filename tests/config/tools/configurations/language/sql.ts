import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const SQL_CLEAN =
    '-- The accounts of the application.\nCREATE TABLE user_accounts (\n    id UUID PRIMARY KEY,\n    display_name TEXT NOT NULL\n);\n';

// A script for psql: a meta-command and two kinds of variable, which the server never sees.
export const PSQL =
    "\\set team 'core'\nSELECT id FROM user_accounts WHERE display_name = :'team' AND id = :account_id;\n";

export const REPOSITORY: InstalledScenario = {
    configurations: ['sql', 'naming'],

    tools: ['sqlfluff'],
    files: {
        'db/accounts.sql': SQL_CLEAN,
        'db/report.sql': PSQL,
        'db/.sqlfluffignore': '# Scripts for psql, which the linter cannot read\nreport.sql\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'sql/sqlfluff',
        files: { 'db/lower.sql': 'select id from user_accounts;\n' },
        expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
    },
];
export const SQL_FUNCTION_SOURCE =
    "CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;\nSELECT get_user_name();\n";
