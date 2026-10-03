// The SQL parser in a fresh process: concurrent parses each keep their own result.
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';

test('concurrent SQL parsing returns independent results in a fresh process', () => {
    const script = `
        import { parse } from ${JSON.stringify(Bun.resolveSync('#cli/parsers/sql/pg.ts', import.meta.dir))};
        const parsed = await Promise.all(['SELECT 1', '${TYPO.select} 2', 'SELECT 3'].map((sql) => parse(sql)));
        console.log(JSON.stringify(parsed.map((result) => result.error ?? null)));
    `;
    const result = Bun.spawnSync([process.execPath, '-e', script], { timeout: 10_000 });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toStrictEqual([
        null,
        { text: `syntax error at or near "${TYPO.select}"`, offset: 0 },
        null,
    ]);
});
