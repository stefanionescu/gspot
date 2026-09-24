import { expect, test } from 'bun:test';
import { progress } from '#cli/output/progress.ts';
import type { CheckResult } from '#cli/output/schema.ts';

test('terminal progress includes cached and skipped checks while log output keeps failures', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    const interactive = progress({ isTTY: true, write: (text) => terminal.push(text) }, false);
    const redirected = progress({ isTTY: false, write: (text) => log.push(text) }, false);
    const result: CheckResult = {
        check: 'example/check',
        scope: 'app',
        status: 'cache',
        files: 1,
        duration: 0,
        findings: [],
    };
    for (const status of ['cache', 'skipped', 'fail', 'missing', 'error'] as const) {
        interactive({ ...result, status });
        redirected({ ...result, status });
    }
    expect(terminal.join('')).toContain('app  example/check  unchanged\n');
    expect(terminal.join('')).toContain('skipped');
    expect(log).toHaveLength(3);
    expect(log.join('')).not.toContain('unchanged');
    expect(log.join('')).not.toContain('skipped');
});

test('quiet terminal progress hides successful checks but retains execution errors', () => {
    const lines: string[] = [];
    const report = progress({ isTTY: true, write: (text) => lines.push(text) }, true);
    const result: CheckResult = {
        check: 'example/check',
        scope: '',
        status: 'ok',
        files: 1,
        duration: 0,
        findings: [],
    };
    report(result);
    expect(lines).toStrictEqual([]);
    report({ ...result, status: 'error' });
    expect(lines).toStrictEqual(['root  example/check  error\n']);
});
