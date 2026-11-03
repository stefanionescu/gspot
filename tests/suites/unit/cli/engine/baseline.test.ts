import { test, expect } from 'bun:test';
import type { CheckResult } from '#cli/types/engine/run.ts';
import { pruneCounts, countFindings, formatBaseline } from '#cli/engine/baseline.ts';

test('the counts group by file, check, and rule, a finding with no rule counts under its check, and exempt checks and fixable findings stay out', () => {
    const rows = [
        ['python/ruff', 'a.py', 'E501', false],
        ['python/ruff', 'a.py', 'E501', false],
        ['python/ruff', 'a.py', 'F401', false],
        ['python/ruff', 'a.py', 'I001', true],
        ['format/prettier', 'a.md', undefined, true],
        ['docs/missing-paths', 'a.md', undefined, false],
        ['secrets/gitleaks-staged', 'a.py', 'key', false],
        ['gspot/generated-files', '.gspot/mise.toml', 'changed', false],
    ] as const;
    const results: CheckResult[] = rows.map(([check, file, rule, fixable]) => ({
        check,
        scope: '',
        status: 'failed',
        fileCount: 1,
        duration: 1,
        findings: [{ check, file, message: 'Found.', fixable, ...(rule !== undefined && { rule }) }],
    }));
    const counts = countFindings(results);
    expect(counts).toStrictEqual([
        { file: 'a.py', check: 'python/ruff', rule: 'E501', count: 2 },
        { file: 'a.py', check: 'python/ruff', rule: 'F401', count: 1 },
        { file: 'a.md', check: 'docs/missing-paths', rule: 'docs/missing-paths', count: 1 },
    ]);
});

test('the file text keeps a stable order, whatever order the counts come in, and keeps a file named __proto__', () => {
    const first = { file: '__proto__', check: 'docs/missing-paths', rule: 'b', count: 1 };
    const second = { file: 'a.py', check: 'python/ruff', rule: 'E501', count: 2 };
    const third = { file: 'a.py', check: 'python/ruff', rule: 'F401', count: 1 };
    const text = formatBaseline([third, first, second]);
    expect(text).toBe(formatBaseline([first, second, third]));
    expect(text).toEndWith('\n');
    expect(JSON.parse(text)).toStrictEqual(
        JSON.parse('{"__proto__":{"docs/missing-paths":{"b":1}},"a.py":{"python/ruff":{"E501":2,"F401":1}}}'),
    );
});

test('pruning lowers a count to what the run found, drops the rest, and adds nothing', () => {
    const base = { file: 'a.py', check: 'python/ruff' };
    const counts = [
        { ...base, rule: 'E501', count: 3 },
        { ...base, rule: 'F401', count: 1 },
    ];
    const found = [
        { ...base, rule: 'E501', count: 2 },
        { ...base, rule: 'E711', count: 4 },
    ];
    expect(pruneCounts(counts, found)).toStrictEqual([{ ...base, rule: 'E501', count: 2 }]);
});
