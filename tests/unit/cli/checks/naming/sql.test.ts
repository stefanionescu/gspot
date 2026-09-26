import { describe, expect, test } from 'bun:test';
import { rejection } from '#tests/support/expectations.ts';
import { sqlIdentifiers } from '#cli/checks/naming/extractors/sql.ts';
import { SQL_SOURCE } from '#tests/constants/unit/cli/checks/naming.ts';

describe('sqlIdentifiers', () => {
    test('every declared name arrives with its category and its line', async () => {
        const found = await sqlIdentifiers('schema.sql', SQL_SOURCE);
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
        expect(await rejection(sqlIdentifiers('broken.sql', 'CREATE TABLE ;'))).toContain('SQL parse failed');
        const identifiers = await sqlIdentifiers('broken.sql', 'CREATE TABLE accounts (id int);');
        expect(identifiers.map((entry) => entry.name)).toStrictEqual(['accounts', 'id']);
    });
});

test('psql declaration variables are excluded while authored names retain their locations', async () => {
    const source = '\\set table accounts\nCREATE TABLE :table ("createdAt" int);\nCREATE TABLE :"id" (id int);';
    const identifiers = await sqlIdentifiers('schema.sql', source);
    expect(identifiers.map(({ name, line, column }) => ({ name, line, column }))).toStrictEqual([
        { name: 'createdAt', line: 2, column: 23 },
        { name: 'id', line: 3, column: 21 },
    ]);
});
