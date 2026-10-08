// The SQL parser in a fresh process: concurrent parses each keep their own result.
import { test, expect } from 'bun:test';
import { parse } from '#cli/parsers/sql/pg.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { SQL_DECLARATION } from '#tests/config/cli/parsers/pg.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';

test('concurrent SQL parsing returns independent results in a fresh process', async () => {
    const script = `
        import { parse } from ${JSON.stringify(await Bun.resolve('#cli/parsers/sql/pg.ts', import.meta.dir))};
        const parsed = await Promise.all(['SELECT 1', '${TYPO.select} 2', 'SELECT 3'].map((sql) => parse(sql)));
        console.log(JSON.stringify(parsed.map((result) => result.error ?? null)));
    `;
    const result = runTestCommandBlocking([process.execPath, '-e', script], { cwd: process.cwd() });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual([
        null,
        { text: `syntax error at or near "${TYPO.select}"`, offset: 0 },
        null,
    ]);
});

test('empty SQL has no statements', async () => {
    const result = await parse('');
    expect(result.error).toBeUndefined();
    expect(result.tree?.stmts ?? []).toStrictEqual([]);
});

test('SQL declarations parse without errors and retain their statement', async () => {
    const sql = await parse(SQL_DECLARATION);
    expect(sql.error).toBeUndefined();
    expect(sql.tree?.stmts).toHaveLength(1);
});
