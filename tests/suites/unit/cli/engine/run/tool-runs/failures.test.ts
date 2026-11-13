import { expect, test } from 'bun:test';

import { OUT_OF_MEMORY_MESSAGE } from '#cli/config/engine.ts';
import { formatOutputTail, isReportedCrash } from '#cli/engine/run/tool-runs/failures.ts';
import { BASE_CHECK, CRASH_TAIL_CASES, ESLINT_CRASH, ESLINT_MANIFEST_TOOL } from '#tests/config/engine/run.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('a shortened failure output keeps the last line of stdout and of stderr', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = formatOutputTail(
        {
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
        },
        'empty',
    );
    expect(detail).toEndWith('\nstdout failure');
    expect(detail.indexOf('stderr failure')).toBeLessThan(detail.indexOf('stdout failure'));
    expect(detail).not.toContain('progress 0\n');
});

test(`a tool's crash pattern marks a crash for a check without its own pattern`, () => {
    expect(isReportedCrash(BASE_CHECK, ESLINT_MANIFEST_TOOL, buildProcessResult(ESLINT_CRASH))).toBe(true);
    expect(
        isReportedCrash(
            BASE_CHECK,
            ESLINT_MANIFEST_TOOL,
            buildProcessResult({ ...ESLINT_CRASH, stderr: '1 problem\n' }),
        ),
    ).toBe(false);
    expect(isReportedCrash(BASE_CHECK, undefined, buildProcessResult(ESLINT_CRASH))).toBe(false);
});

test('a tool that runs out of memory gets a cause instead of the garbage collector dump', () => {
    const dump =
        '<--- Last few GCs --->\n[4242:0x1] 9000 ms: Mark-Compact 4047.9 (4130.5) -> 4033.4 (4131.2) MB\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n';
    expect(formatOutputTail({ stdout: '', stderr: dump })).toBe(OUT_OF_MEMORY_MESSAGE);
});

test.each(CRASH_TAIL_CASES)(
    'a crash tail keeps the cause and hides stack frames: $name',
    ({ stdout, stderr, expected, verbose }) => {
        expect(formatOutputTail({ stdout, stderr })).toBe(expected);
        expect(formatOutputTail({ stdout, stderr }, '', { verbose: true })).toBe(verbose);
    },
);
