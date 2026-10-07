import { test, expect, describe } from 'bun:test';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/command/findings.ts';
import { hasToolError, toolOutputDetail } from '#cli/execution/command/failures.ts';
import { ESLINT_TOOL, ESLINT_CRASH } from '#tests/config/cli/execution/command/failures.ts';

test('bounded failure output retains the final diagnostic from both streams', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = toolOutputDetail(
        {
            code: 1,
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
            missing: false,
            duration: 1,
        },
        'empty',
    );
    expect(detail).toContain('stdout failure');
    expect(detail).toContain('stderr failure');
    expect(detail).not.toContain('progress 0\n');
    expect(detail.length).toBeLessThan(`${progress}\nstdout failure\n${progress}\nstderr failure`.length);
});

describe('hasToolError', () => {
    test("a tool's crash pattern detects crashes for every check that runs it", () => {
        expect(hasToolError(BASE_CHECK, ESLINT_TOOL, ESLINT_CRASH)).toBe(true);
        expect(hasToolError(BASE_CHECK, ESLINT_TOOL, { ...ESLINT_CRASH, stderr: '1 problem\n' })).toBe(false);
        expect(hasToolError(BASE_CHECK, undefined, ESLINT_CRASH)).toBe(false);
    });

    test("a check's own pattern comes before the tool's", () => {
        const check = { ...BASE_CHECK, crash_pattern: '^Fatal:' } satisfies CheckDeclaration;
        expect(hasToolError(check, ESLINT_TOOL, ESLINT_CRASH)).toBe(false);
        expect(hasToolError(check, ESLINT_TOOL, { ...ESLINT_CRASH, stderr: 'Fatal: cannot write\n' })).toBe(true);
    });
});
