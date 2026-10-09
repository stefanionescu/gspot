import { test, expect } from 'bun:test';
import { parse } from '#cli/parsers/sql/contracts.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { SQL_DECLARATION } from '#tests/config/cli/parsers/pg.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

test('concurrent SQL parsing returns independent results in a fresh process', async () => {
    const script = `
        import { parse } from ${JSON.stringify(await Bun.resolve('#cli/parsers/sql/contracts.ts', import.meta.dir))};
        const parsed = await Promise.all(['SELECT 1', '${TYPO.select} 2', 'SELECT 3'].map(parse));
        console.log(JSON.stringify(parsed.map((result) => result.error ?? null)));
    `;
    const result = runTestCommandBlocking([process.execPath, '-e', script], { cwd: process.cwd() });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual([null, containing({ text: textContaining(TYPO.select) }), null]);
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
