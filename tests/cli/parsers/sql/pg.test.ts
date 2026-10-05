// The SQL parser in a fresh process: concurrent parses each keep their own result.
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/harness/spelling.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';

test('concurrent SQL parsing returns independent results in a fresh process', () => {
    const script = `
        import { parse } from ${JSON.stringify(Bun.resolveSync('#cli/parsers/sql/pg.ts', import.meta.dir))};
        const parsed = await Promise.all(['SELECT 1', '${TYPO.select} 2', 'SELECT 3'].map((sql) => parse(sql)));
        console.log(JSON.stringify(parsed.map((result) => result.error ?? null)));
    `;
    const result = runTestCommandBlocking([process.execPath, '-e', script], { cwd: process.cwd(), timeoutMs: 10_000 });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual([
        null,
        { text: `syntax error at or near "${TYPO.select}"`, offset: 0 },
        null,
    ]);
});
