import { expect, test } from 'bun:test';
import { underFloor } from '#cli/checks/xctest/coverage.ts';

test('the coverage check compares each named target with its floor', () => {
    const report = { targets: [{ name: 'App.app', lineCoverage: 0.617 }] };
    expect(underFloor(report, [{ target: 'App', percent: 60 }])).toEqual([]);
    expect(underFloor(report, [{ target: 'App', percent: 80 }])).toEqual([
        'App covers 61 of 100 lines, under the floor of 80.',
    ]);
    expect(underFloor(report, [{ target: 'Widget', percent: 10 }])).toEqual([
        'The coverage report holds no target named Widget.',
    ]);
});
