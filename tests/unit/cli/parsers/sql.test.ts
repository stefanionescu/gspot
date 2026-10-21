import { test, expect } from 'bun:test';
import { getPosition } from '#cli/system/text.ts';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { parseSqlFile } from '#cli/parsers/sql/postgres.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('empty SQL has no statements', async () => {
    const result = await parseSqlFile('', createReadCache(process.cwd()));
    expect(result.error).toBeUndefined();
    expect(result.statements).toStrictEqual([]);
});

test('SQL statement positions skip nested comments and count Unicode correctly', async () => {
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
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.error).toBeUndefined();
    expect(parsed.statements.map((statement) => statement.kind)).toStrictEqual(['DropStmt', 'SelectStmt']);
    expect(parsed.statements.map((statement) => getPosition(text, statement.start))).toStrictEqual([
        { line: 5, column: 1 },
        { line: 8, column: 2 },
    ]);
});

test('psql commands and variables keep error positions and PostgreSQL casts', async () => {
    const text = [
        String.raw`\set account '前言'`,
        'SELECT :account::int, :\'label\', :"column" FROM :table;',
        'SELECT 1+:value, account$tag$ FROM user_accounts;',
        `${TYPO.select} 2;`,
    ].join('\n');
    const broken = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(broken.error).toStrictEqual({ text: `syntax error at or near "${TYPO.select}"`, line: 4, column: 1 });
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, 'SELECT 2'), createReadCache(process.cwd()));
    expect(corrected.error).toBeUndefined();
    expect(corrected.statements.map((statement) => getPosition(text, statement.start))).toStrictEqual([
        { line: 2, column: 1 },
        { line: 3, column: 1 },
        { line: 4, column: 1 },
    ]);
});

test('psql tokens inside quoted SQL and nested comments stay literal', async () => {
    const text = [
        "SELECT ':value', E'\\\\:value', $$:value$$, $body$\n\\set literal\n$body$;",
        '/* :value /* :nested */ :value */',
        '-- :value',
        'SELECT 1::int;',
    ].join('\n');
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.error).toBeUndefined();
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    const unclosedComment = await parseSqlFile('SELECT 1; /* :unclosed', createReadCache(process.cwd()));
    expect(unclosedComment.error?.text).toContain('unterminated');
});

test('an SQL error after Unicode points at the right token', async () => {
    const text = `SELECT '前言😀', :value; ${TYPO.select} 2;`;
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.error).toStrictEqual({
        text: `syntax error at or near "${TYPO.select}"`,
        line: 1,
        column: text.lastIndexOf(TYPO.select) + 1,
    });
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, 'SELECT 2'), createReadCache(process.cwd()));
    expect(corrected.error).toBeUndefined();
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value gives the parser error at its start', async (opener) => {
    const text = `SELECT ${opener}:value\n\\set literal\n-- :fixture`;
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    expect(parsed.error?.text).toContain('unterminated');
    expect(parsed.error?.line).toBe(1);
    expect(parsed.error?.column).toBe(8);
});
