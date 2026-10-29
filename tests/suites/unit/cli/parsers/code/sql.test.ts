import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/spelling.ts';
import { getPosition } from '#cli/system/text.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { parseSqlFile, selectFrozenMigrations } from '#cli/parsers/code/sql.ts';

import {
    SELECT_SQL,
    NESTED_COMMENT_SQL,
    QUOTED_PSQL_SOURCES,
    FROZEN_MIGRATION_CASES,
    FROZEN_MIGRATION_PATHS,
} from '#tests/config/parsers/code/sql.ts';

test('empty SQL has no statements', async () => {
    const result = await parseSqlFile('', createReadCache(process.cwd()));
    expect(result.error).toBeUndefined();
    expect(result.statements).toStrictEqual([]);
});

test('SQL statement positions skip nested comments and count each Unicode character as one column', async () => {
    const parsed = await parseSqlFile(NESTED_COMMENT_SQL, createReadCache(process.cwd()));
    expect(parsed.error).toBeUndefined();
    expect(parsed.statements.map((statement) => statement.kind)).toStrictEqual(['DropStmt', 'SelectStmt']);
    expect(parsed.statements.map((statement) => getPosition(NESTED_COMMENT_SQL, statement.start))).toStrictEqual([
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
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, SELECT_SQL), createReadCache(process.cwd()));
    expect(corrected.error).toBeUndefined();
    expect(corrected.statements.map((statement) => getPosition(text, statement.start))).toStrictEqual([
        { line: 2, column: 1 },
        { line: 3, column: 1 },
        { line: 4, column: 1 },
    ]);
});

test('psql tokens inside quoted SQL and nested comments stay literal', async () => {
    const text = [...QUOTED_PSQL_SOURCES].join('\n');
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.error).toBeUndefined();
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    const unclosedComment = await parseSqlFile('SELECT 1; /* :unclosed', createReadCache(process.cwd()));
    expect(unclosedComment.error).toStrictEqual({
        text: 'unterminated /* comment at or near "/* :unclosed"',
        line: 1,
        column: 11,
    });
});

test('an SQL error after Unicode points at the right token', async () => {
    const text = `SELECT '前言😀', :value; ${TYPO.select} 2;`;
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.error).toStrictEqual({
        text: `syntax error at or near "${TYPO.select}"`,
        line: 1,
        column: text.lastIndexOf(TYPO.select) + 1,
    });
    const corrected = await parseSqlFile(text.replace(`${TYPO.select} 2`, SELECT_SQL), createReadCache(process.cwd()));
    expect(corrected.error).toBeUndefined();
});

test.each(["'", "E'", '"'])('an unterminated SQL %s value gives the parser error at its start', async (opener) => {
    const text = `SELECT ${opener}:value\n\\set literal\n-- :sample`;
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    const kind = opener === '"' ? 'quoted identifier' : 'quoted string';
    expect(parsed.error).toStrictEqual({
        text: `unterminated ${kind} at or near "${text.slice('SELECT '.length)}"`,
        line: 1,
        column: 8,
    });
});

test.each([...FROZEN_MIGRATION_CASES])(
    'freeze version $through selects the frozen migrations',
    ({ through, frozen }) => {
        expect([...selectFrozenMigrations([...FROZEN_MIGRATION_PATHS], through)]).toStrictEqual([...frozen]);
    },
);
