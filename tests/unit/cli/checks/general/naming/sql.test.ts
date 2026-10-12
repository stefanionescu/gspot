import { test, expect } from 'bun:test';
import { sqlIdentifiers } from '#cli/checks/general/naming/sql.ts';
import { SQL_DECLARATIONS, QUALIFIED_FUNCTION_DECLARATION } from '#tests/config/sql.ts';

test('every SQL name comes with its category and line', async () => {
    const found = await sqlIdentifiers('schema.sql', SQL_DECLARATIONS);
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
    expect(found[1]?.label).toBe('sql table');
});

test('psql variables are not names, and quoted names keep their positions', async () => {
    const source = '\\set table accounts\nCREATE TABLE :table ("createdAt" int);\nCREATE TABLE :"id" (id int);';
    const identifiers = await sqlIdentifiers('schema.sql', source);
    expect(identifiers.map(({ name, line, column }) => ({ name, line, column }))).toStrictEqual([
        { name: 'createdAt', line: 2, column: 23 },
        { name: 'id', line: 3, column: 21 },
    ]);
});

test('SQL declared names retain exact source positions', async () => {
    const found = await sqlIdentifiers('schema.sql', 'CREATE TABLE user_accounts (display_name text);');
    expect(found.map(({ name, line, column }) => ({ name, line, column }))).toStrictEqual([
        { name: 'user_accounts', line: 1, column: 14 },
        { name: 'display_name', line: 1, column: 29 },
    ]);
});

test('qualified SQL function and parameter names use their own declaration positions', async () => {
    const found = await sqlIdentifiers('schema.sql', QUALIFIED_FUNCTION_DECLARATION);
    expect(found.map(({ category, name, line, column }) => ({ category, name, line, column }))).toStrictEqual([
        { category: 'functions', name: 'same', line: 1, column: 22 },
        { category: 'parameters', name: 'same', line: 1, column: 39 },
        { category: 'parameters', name: 'out', line: 1, column: 77 },
        { category: 'parameters', name: 'variadic', line: 1, column: 101 },
        { category: 'functions', name: 'named', line: 3, column: 23 },
        { category: 'parameters', name: 'named', line: 4, column: 5 },
        { category: 'parameters', name: 'out', line: 5, column: 6 },
    ]);
});
