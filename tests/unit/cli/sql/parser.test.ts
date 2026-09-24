import { describe, expect, test } from 'bun:test';
import { parseSql } from '#cli/parsers/sql/parser.ts';
import { sqlFile, positionAt } from '#cli/parsers/sql/statements.ts';

describe('parseSql', () => {
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

test('concurrent SQL parsing initializes the WASM module once in a fresh process', () => {
    const script = `
        import { spyOn } from 'bun:test';
        import * as fs from 'node:fs';
        import { parseSql } from ${JSON.stringify(Bun.resolveSync('#cli/parsers/sql/parser.ts', import.meta.dir))};
        const original = fs.readFileSync;
        let loads = 0;
        spyOn(fs, 'readFileSync').mockImplementation((path, ...args) => {
            if (String(path).endsWith('libpg-query.wasm')) loads += 1;
            return original(path, ...args);
        });
        const parsed = await Promise.all(Array.from({length: 8}, (_, index) => parseSql('SELECT ' + index)));
        if (parsed.some((result) => result.error !== undefined)) process.exit(1);
        console.log(loads);
    `;
    const result = Bun.spawnSync([process.execPath, '-e', script]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(result.stdout.toString().trim()).toBe('1');
});
