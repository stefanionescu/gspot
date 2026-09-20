import { describe, expect, test } from 'bun:test';
import { parseSql } from '#cli/readers/sql/parser.ts';
import { sqlFile, positionAt } from '#cli/readers/sql/statements.ts';

describe('parseSql', () => {
    test('a statement parses into a tree with its kind', async () => {
        const parsed = await parseSql('CREATE TABLE app.users (id uuid PRIMARY KEY);');
        expect(Object.keys(parsed.tree?.stmts?.[0]?.stmt ?? {})).toEqual(['CreateStmt']);
    });

    test('a broken statement returns the error and where it points', async () => {
        const parsed = await parseSql('SELECT 1;\nSELEC 2;');
        expect(parsed.error?.text).toContain('syntax error');
        expect(parsed.error?.offset).toBe(10);
    });
});

test('SQL statement positions skip nested comments and count Unicode prefixes correctly', async () => {
    const text = [
        '-- 前言',
        '/* outer',
        ' /* nested */',
        '*/',
        'DROP TABLE app.users;',
        '-- Between statements.',
        '/* next */',
        ' SELECT 1;',
    ].join('\n');
    const parsed = await sqlFile(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.statements.map((statement) => statement.kind)).toEqual(['DropStmt', 'SelectStmt']);
    expect(parsed.statements.map((statement) => positionAt(text, statement.start))).toEqual([
        { line: 5, column: 1 },
        { line: 8, column: 2 },
    ]);
});
