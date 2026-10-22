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

/** The positions of qualified SQL function and parameter names. */
export const QUALIFIED_SQL_NAMES = [
    { category: 'functions', name: 'same', line: 1, column: 22 },
    { category: 'parameters', name: 'same', line: 1, column: 39 },
    { category: 'parameters', name: 'out', line: 1, column: 77 },
    { category: 'parameters', name: 'variadic', line: 1, column: 101 },
    { category: 'functions', name: 'named', line: 3, column: 23 },
    { category: 'parameters', name: 'named', line: 4, column: 5 },
    { category: 'parameters', name: 'out', line: 5, column: 6 },
] as const;

/** Each SQL name with its category and line. */
export const SQL_DECLARED_NAMES: (string | number)[][] = [
    ['schemas', 'app', 2],
    ['tables', 'user_accounts', 4],
    ['columns', 'id', 5],
    ['columns', 'displayName', 6],
    ['columns', 'created_at', 9],
    ['indexes', 'user_accounts_created_idx', 10],
    ['functions', 'touch_account', 11],
    ['parameters', 'account_id', 11],
    ['policies', 'owner_reads', 12],
    ['triggers', 'touch_on_write', 13],
    ['tables', 'active_accounts', 14],
];
