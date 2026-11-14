import { test, expect } from 'bun:test';
import type { CheckResult } from '#cli/types/engine/run.ts';
import { mergeCheckResults, restoreCommandPaths } from '#cli/engine/results.ts';

test('a result from a copy names repository paths in its command and its note', () => {
    const base: CheckResult = {
        check: 'typescript/tsc',
        scope: '',
        status: 'error',
        fileCount: 0,
        duration: 0,
        findings: [],
    };
    const restored = restoreCommandPaths(
        { ...base, command: ['/copy/bin/tsc', '/copy/tsconfig.json'], note: 'Stopped at /copy/a.ts and /copy/b.ts.' },
        '/copy',
        '/repository',
    );
    expect(restored).toStrictEqual({
        ...base,
        command: ['/repository/bin/tsc', '/repository/tsconfig.json'],
        note: 'Stopped at /repository/a.ts and /repository/b.ts.',
    });
    expect(restoreCommandPaths(base, '/copy', '/repository')).toStrictEqual(base);
});

test('merged runs that overlap report the wall time from the first start to the last end', () => {
    const base = {
        check: 'commits/commitlint-pushed',
        scope: '',
        status: 'passed',
        fileCount: 0,
        duration: 0,
        findings: [],
    } as const;
    const first = { ...base, duration: 1000, span: { start: 100, end: 1100 } };
    const second = { ...base, duration: 1500, span: { start: 300, end: 1800 } };
    const merged = mergeCheckResults(mergeCheckResults(base, first), second);
    expect(merged.duration).toBe(1700);
    expect(merged.span).toStrictEqual({ start: 100, end: 1800 });
});
