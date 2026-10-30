import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { BASE_CHECK } from '#tests/config/runs/command/check.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildCheckResult, parseCommandFindings } from '#cli/runs/command/output.ts';
import { FILELESS_COVERAGE_CASES } from '#tests/config/runs/command/output/coverage.ts';

test.each(FILELESS_COVERAGE_CASES)(
    '$check exit $code keeps the fileless result as a failed check',
    async ({ check: id, code, output, message }) => {
        await using sandbox = await testdir();
        const check = getShippedCheck(id);
        const parsed = parseCommandFindings({ check }, buildProcessResult({ code, stdout: output }), {
            root: sandbox.path,
            cwd: sandbox.path,
        });
        expect(parsed.findings).toStrictEqual([{ check: id, file: '', message, help: check.help, fixable: false }]);
        expect(parsed.note).toBeUndefined();
        const result = buildCheckResult(check, {
            base: { check: id, scope: '', status: 'passed', fileCount: 0, duration: 0, findings: [] },
            state: { root: sandbox.path, cwd: sandbox.path, failed: true, findings: parsed.findings! },
            commandArguments: [],
            started: performance.now(),
        });
        expect(result.status).toBe('failed');
        expect(result.findings).toStrictEqual(parsed.findings!);
    },
);

test('grouped output that locates no existing file is an error', async () => {
    await using sandbox = await testdir();
    const check = {
        ...BASE_CHECK,
        output: {
            format: 'grouped' as const,
            file_pattern: '^(?<file>.+):$',
            pattern: String.raw`^  (?<line>\d+): (?<message>.+)$`,
        },
    };
    expect(
        parseCommandFindings({ check }, buildProcessResult({ code: 1, stdout: 'missing.ts:\n  1: A defect.' }), {
            root: sandbox.path,
            cwd: sandbox.path,
        }),
    ).toStrictEqual({ note: 'sandbox/diagnostic failed with exit 1:\nmissing.ts:\n  1: A defect.' });
});
