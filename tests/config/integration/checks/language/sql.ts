export const SQL_DUCKDB_SOURCE = 'FROM records SELECT id;\n';

const SQL_CLEAN = `-- The accounts of the application.
CREATE TABLE user_accounts (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL
);
`;

export const SQL_SANDBOX = {
    configurations: ['sql'],
    files: {
        'db/accounts.sql': SQL_CLEAN,
        'db/report.sql':
            "\\set team 'core'\nSELECT id FROM user_accounts WHERE display_name = :'team' AND id = :account_id;\n",
    },
} as const;

export const SQL_CASES = [
    {
        check: 'sql/sqlfluff',
        files: { 'db/lower.sql': 'SELECT id from user_accounts;\n' },
        corrected: { files: { 'db/lower.sql': 'SELECT id FROM user_accounts;\n' } },
        expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
    },
] as const;

export const SQL_FUNCTION_SOURCE = `CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;
SELECT get_user_name();
`;

/** Settings with a root and a scope SQLFluff dialect. */
export const SQLFLUFF_DIALECT_SETTINGS = {
    tables: `[tools.sqlfluff]
dialect = "postgres"
[[scope]]
path = "warehouse"
[scope.tools.sqlfluff]
dialect = "duckdb"
[[scope]]
path = "warehouse/child"
`,
} as const;
