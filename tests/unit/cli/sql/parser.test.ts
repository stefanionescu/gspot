import { describe, expect, test } from 'bun:test';
import { parseSql } from '#cli/parsers/sql/parser.ts';
import { sqlIdentifiers } from '#cli/naming/extractors/sql.ts';
import type { SourceObservations } from '#cli/repository/tree.ts';
import { sqlFile, positionAt } from '#cli/parsers/sql/statements.ts';

describe('parseSql', () => {
    test('a broken statement returns the error and where it points', async () => {
        const parsed = await parseSql('SELECT 1;\nSELEC 2;');
        expect(parsed.error?.text).toContain('syntax error');
        expect(parsed.error?.offset).toBe(10);
    });
});

test('SQL analyses share concurrent parses and refresh after source corrections', async () => {
    const observations: SourceObservations = { root: '/repository', sources: new Map() };
    const source = 'CREATE TABLE user_accounts (display_name text);';
    const first = sqlFile(source, observations);
    expect(sqlFile(source, observations)).toBe(first);
    const [parsed, identifiers] = await Promise.all([first, sqlIdentifiers('accounts.sql', source, observations)]);
    expect(parsed.error).toBeUndefined();
    expect(
        identifiers.map((identifier) => ({ name: identifier.name, line: identifier.line, column: identifier.column })),
    ).toStrictEqual([
        { name: 'user_accounts', line: 1, column: 14 },
        { name: 'display_name', line: 1, column: 29 },
    ]);
    const broken = 'SELECT 1;\nSELEC 2;';
    expect((await sqlFile(broken, observations)).error).toStrictEqual({
        text: 'syntax error at or near "SELEC"',
        line: 2,
        column: 1,
    });
    await expect(sqlIdentifiers('broken.sql', broken, observations)).rejects.toThrow('SQL parse failed at 2:1');
    expect((await sqlFile(broken.replace('SELEC 2', 'SELECT 2'), observations)).error).toBeUndefined();
    const refreshed = sqlFile(source, { root: observations.root, sources: new Map() });
    expect(refreshed).not.toBe(first);
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
    const parsed = await sqlFile(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.statements.map((statement) => statement.kind)).toStrictEqual(['DropStmt', 'SelectStmt']);
    expect(parsed.statements.map((statement) => positionAt(text, statement.start))).toStrictEqual([
        { line: 5, column: 1 },
        { line: 8, column: 2 },
    ]);
});

test('concurrent SQL parsing returns independent results in a fresh process', () => {
    const script = `
        import { parseSql } from ${JSON.stringify(Bun.resolveSync('#cli/parsers/sql/parser.ts', import.meta.dir))};
        const parsed = await Promise.all(['SELECT 1', 'SELEC 2', 'SELECT 3'].map((sql) => parseSql(sql)));
        console.log(JSON.stringify(parsed.map((result) => result.error ?? null)));
    `;
    const result = Bun.spawnSync([process.execPath, '-e', script]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toStrictEqual([
        null,
        { text: 'syntax error at or near "SELEC"', offset: 0 },
        null,
    ]);
});

test('psql commands and variables preserve diagnostic positions and PostgreSQL casts', async () => {
    const text = [
        "\\set account '前言'",
        'SELECT :account::int, :\'label\', :"column" FROM :table;',
        'SELECT 1+:value, account$tag$ FROM user_accounts;',
        'SELEC 2;',
    ].join('\n');
    const broken = await sqlFile(text);
    expect(broken.error).toStrictEqual({ text: 'syntax error at or near "SELEC"', line: 4, column: 1 });
    const corrected = await sqlFile(text.replace('SELEC 2', 'SELECT 2'));
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
    const parsed = await sqlFile(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.source).toBe(text);
    expect(parsed.variables).toStrictEqual([]);
    expect((await sqlFile("SELECT ':unterminated;")).error?.text).toContain('unterminated');
    expect((await sqlFile('SELECT 1; /* :unclosed')).error?.text).toContain('unterminated');
});

test('SQL errors after Unicode point at the original token', async () => {
    const text = "SELECT '前言😀', :value; SELEC 2;";
    expect((await sqlFile(text)).error).toStrictEqual({
        text: 'syntax error at or near "SELEC"',
        line: 1,
        column: text.lastIndexOf('SELEC') + 1,
    });
    expect((await sqlFile(text.replace('SELEC 2', 'SELECT 2'))).error).toBeUndefined();
});
