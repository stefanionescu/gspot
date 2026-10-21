export const SQL_DUCKDB_SOURCE = 'FROM records SELECT id;\n';

export const CHILD_POSTGRES_TABLES = `[[scope]]
path = "app"

configurations = ["postgres"]
[scope.postgres]
frozen_through = "2"
`;

export const CHILD_MIGRATIONS = {
    'migrations/V1_root.sql': 'SELECT 1;\n',
    'app/migrations/V2_first.sql': 'SELECT 2;\n',
    'app/migrations/V10_next.sql': 'SELECT 10;\n',
    'other/migrations/V1_other.sql': 'SELECT 1;\n',
} as const;

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
        files: { 'db/lower.sql': 'select id from user_accounts;\n' },
        corrected: { files: { 'db/lower.sql': 'SELECT id FROM user_accounts;\n' } },
        expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
    },
] as const;

export const SQL_FUNCTION_SOURCE = `CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;
SELECT get_user_name();
`;

export const SQL_DECLARATIONS = `-- Accounts.
CREATE SCHEMA app;

CREATE TABLE app.user_accounts (
    id uuid PRIMARY KEY,
    "displayName" text NOT NULL
);

ALTER TABLE app.user_accounts ADD COLUMN created_at timestamptz;
CREATE INDEX user_accounts_created_idx ON app.user_accounts (created_at);
CREATE FUNCTION app.touch_account(account_id uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
CREATE POLICY owner_reads ON app.user_accounts FOR SELECT USING (true);
CREATE TRIGGER touch_on_write BEFORE UPDATE ON app.user_accounts FOR EACH ROW EXECUTE FUNCTION app.touch_account();
CREATE VIEW app.active_accounts AS SELECT id FROM app.user_accounts;
`;

export const QUALIFIED_FUNCTION_DECLARATION = `CREATE FUNCTION same.same(integer, IN same integer DEFAULT same(1, 2), OUT "out" integer, VARIADIC "variadic" integer[])
RETURNS integer LANGUAGE sql AS $$SELECT same$$;
CREATE FUNCTION named.named() RETURNS TABLE (
    named integer,
    "out" integer
) LANGUAGE sql AS $$SELECT 1, 2$$;
`;

/** A local SQL check program for the file selection and fix tests. */
const SQL_CHECK_PROGRAM = `const fs = require('node:fs'); for (const path of process.argv.slice(1)) { if (fs.readFileSync(path, 'utf8').includes('CREATE FUNCTION')) { console.log(path + ':1: Replace the sample function.'); process.exitCode = 1; } }`;

export const SQL_CHECK = `[[command_check]]
id = "project/read-sql"
paths = ["**/*.sql"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', SQL_CHECK_PROGRAM, '{files}'])}
`;
