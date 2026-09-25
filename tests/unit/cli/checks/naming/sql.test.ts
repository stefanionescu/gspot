import { sqlIdentifiers } from '#cli/checks/naming/extractors/sql.ts';
import { describe, expect, test } from 'bun:test';

const SOURCE = `-- Accounts.
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

describe('sqlIdentifiers', () => {
    test('every declared name arrives with its category and its line', async () => {
        const found = await sqlIdentifiers('schema.sql', SOURCE);
        expect(found.map((entry) => [entry.category, entry.name, entry.line])).toStrictEqual([
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
        ]);
        expect(found[1]?.kind).toBe('sql table');
    });

    test('invalid SQL fails analysis and corrected SQL yields identifiers', async () => {
        await expect(sqlIdentifiers('broken.sql', 'CREATE TABLE ;')).rejects.toThrow('SQL parse failed');
        expect(
            (await sqlIdentifiers('broken.sql', 'CREATE TABLE accounts (id int);')).map((entry) => entry.name),
        ).toStrictEqual(['accounts', 'id']);
    });
});

test('psql declaration variables are excluded while authored names retain their locations', async () => {
    const source = '\\set table accounts\nCREATE TABLE :table ("createdAt" int);\nCREATE TABLE :"id" (id int);';
    expect(
        (await sqlIdentifiers('schema.sql', source)).map(({ name, line, column }) => ({ name, line, column })),
    ).toStrictEqual([
        { name: 'createdAt', line: 2, column: 23 },
        { name: 'id', line: 3, column: 21 },
    ]);
});
