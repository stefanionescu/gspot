import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { sqlIdentifiers } from '#cli/parsers/naming/sql.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { positionAt, parseSqlFile } from '#cli/parsers/sql/statements.ts';

test('SQL analyses share concurrent parses and refresh after source corrections', async () => {
    const reads: ReadCache = { root: '/repository', sources: new Map(), memo: new Map() };
    const source = 'CREATE TABLE user_accounts (display_name text);';
    const first = parseSqlFile(source, reads);
    const [parsed, identifiers] = await Promise.all([first, sqlIdentifiers('accounts.sql', source, reads)]);
    expect(parsed.error).toBeUndefined();
    expect(
        identifiers.map((identifier) => ({ name: identifier.name, line: identifier.line, column: identifier.column })),
    ).toStrictEqual([
        { name: 'user_accounts', line: 1, column: 14 },
        { name: 'display_name', line: 1, column: 29 },
    ]);
    const broken = `SELECT 1;\n${TYPO.select} 2;`;
    const failed = await parseSqlFile(broken, reads);
    expect(failed.error).toStrictEqual({
        text: `syntax error at or near "${TYPO.select}"`,
        line: 2,
        column: 1,
    });
    expect(await rejection(sqlIdentifiers('broken.sql', broken, reads))).toBe(
        `broken.sql:2:1: SQL parse failed: syntax error at or near "${TYPO.select}"`,
    );
    const corrected = await parseSqlFile(broken.replace(`${TYPO.select} 2`, 'SELECT 2'), reads);
    expect(corrected.error).toBeUndefined();
    const refreshed = parseSqlFile(source, { root: reads.root, sources: new Map(), memo: new Map() });
    expect(await refreshed).toStrictEqual(parsed);
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
    const parsed = await parseSqlFile(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.statements.map((statement) => statement.kind)).toStrictEqual(['DropStmt', 'SelectStmt']);
    expect(parsed.statements.map((statement) => positionAt(text, statement.start))).toStrictEqual([
        { line: 5, column: 1 },
        { line: 8, column: 2 },
    ]);
});

test('psql commands and variables preserve diagnostic positions and PostgreSQL casts', async () => {
    const text = [
        String.raw`\set account '前言'`,
        'SELECT :account::int, :\'label\', :"column" FROM :table;',
        'SELECT 1+:value, account$tag$ FROM user_accounts;',
        `${TYPO.select} 2;`,
    ].join('\n');
    const broken = await parseSqlFile(text);
    expect(broken.error).toStrictEqual({ text: `syntax error at or near "${TYPO.select}"`, line: 4, column: 1 });
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, 'SELECT 2'));
    expect(corrected.error).toBeUndefined();
    expect(corrected.statements.map((statement) => positionAt(text, statement.start))).toStrictEqual([
        { line: 2, column: 1 },
        { line: 3, column: 1 },
        { line: 4, column: 1 },
    ]);
});

test('psql tokens inside quoted SQL and nested comments retain their literal contents', async () => {
    const text = [
        "SELECT ':value', E'\\\\:value', $$:value$$, $body$\n\\set literal\n$body$;",
        '/* :value /* :nested */ :value */',
        '-- :value',
        'SELECT 1::int;',
    ].join('\n');
    const parsed = await parseSqlFile(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    const unclosedComment = await parseSqlFile('SELECT 1; /* :unclosed');
    expect(unclosedComment.error?.text).toContain('unterminated');
});

test('SQL errors after Unicode point at the original token', async () => {
    const text = `SELECT '前言😀', :value; ${TYPO.select} 2;`;
    const parsed = await parseSqlFile(text);
    expect(parsed.error).toStrictEqual({
        text: `syntax error at or near "${TYPO.select}"`,
        line: 1,
        column: text.lastIndexOf(TYPO.select) + 1,
    });
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, 'SELECT 2'));
    expect(corrected.error).toBeUndefined();
});

test.each(["'", "E'", '"'])(
    'an unterminated SQL %s value preserves client-shaped text for the native error',
    async (opener) => {
        const text = `SELECT ${opener}:value\n\\set literal\n-- :fixture`;
        const parsed = await parseSqlFile(text);
        expect(parsed.source).toBe(text);
        expect(parsed.variables).toStrictEqual([]);
        expect(parsed.error?.text).toContain('unterminated');
        expect(parsed.error?.line).toBe(1);
        expect(parsed.error?.column).toBe(8);
    },
);
