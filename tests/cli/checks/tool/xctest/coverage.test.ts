import { test, expect } from 'bun:test';
import { coverageShortfalls } from '#cli/checks/tool/contracts.ts';

test('the coverage check compares each named target with its floor', () => {
    const report = { targets: [{ name: 'App.app', lineCoverage: 0.617 }] };
    expect(coverageShortfalls(report, { lines: 0, overrides: [{ target: 'App', percent: 61 }] })).toStrictEqual([]);
    expect(coverageShortfalls(report, { lines: 0, overrides: [{ target: 'App', percent: 62 }] })).toStrictEqual([
        'App covers 61% of its lines, under the floor of 62%.',
    ]);
    expect(coverageShortfalls(report, { lines: 0, overrides: [{ target: 'Widget', percent: 10 }] })).toStrictEqual([
        'The coverage report has no target named Widget.',
    ]);
});

test('the shared coverage floor applies to every source target without overriding a named floor', () => {
    const report = {
        targets: [
            { name: 'App', lineCoverage: 0.6 },
            { name: 'Library', lineCoverage: 0.75 },
        ],
    };
    expect(coverageShortfalls(report, { lines: 70, overrides: [] })).toStrictEqual([
        'App covers 60% of its lines, under the floor of 70%.',
    ]);
    expect(coverageShortfalls(report, { lines: 70, overrides: [{ target: 'App', percent: 60 }] })).toStrictEqual([]);
    expect(coverageShortfalls(report, { lines: 0, overrides: [] })).toStrictEqual([]);
});
