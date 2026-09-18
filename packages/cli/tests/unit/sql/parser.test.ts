import { parseSql } from '#cli/sql/parser.ts';
import { describe, expect, test } from 'bun:test';

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
