import { test, expect } from 'bun:test';
import { coverageShortfalls } from '#cli/checks/tool/xctest.ts';

test('the coverage check compares each named target with its floor', () => {
    const report = { targets: [{ name: 'App.app', lineCoverage: 0.617 }] };
    expect(coverageShortfalls(report, [{ target: 'App', percent: 61 }])).toStrictEqual([]);
    expect(coverageShortfalls(report, [{ target: 'App', percent: 62 }])).toStrictEqual([
        'App covers 61% of its lines, under the floor of 62%.',
    ]);
    expect(coverageShortfalls(report, [{ target: 'Widget', percent: 10 }])).toStrictEqual([
        'The coverage report has no target named Widget.',
    ]);
});
