import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { TYPE_ERROR_MESSAGE } from '#tests/config/typescript.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { isReportedCrash, formatOutputTail, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    BASE_CHECK,
    ESLINT_CRASH,
    CRASH_TAIL_CASES,
    ASTRO_CHECK_OUTPUT,
    ASTRO_CHECK_SUMMARY,
    ESLINT_MANIFEST_TOOL,
} from '#tests/config/runs/command/check.ts';

test('a shortened failure output keeps the last line of stdout and of stderr', () => {
    const progress = Array.from({ length: 30 }, (_, index) => `progress ${String(index)}`).join('\n');
    const detail = formatOutputTail(
        {
            stdout: `${progress}\nstdout failure`,
            stderr: `${progress}\nstderr failure`,
        },
        'empty',
    );
    const tail = Array.from({ length: 19 }, (_, index) => `progress ${String(11 + index)}`);
    expect(detail).toBe([...tail, 'stderr failure', ...tail, 'stdout failure'].join('\n'));
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
    expect(formatOutputTail({ stdout: '', stderr: dump })).toBe(
        'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.',
    );
});

test('a network crash keeps its output tail and states the network requirement separately', async () => {
    await using sandbox = await testdir();
    const check = { ...BASE_CHECK, needs: ['network' as const], exit_codes: [0] };
    const result = buildProcessResult({ code: 2, stdout: '{"Results":[]}', stderr: 'scan log\nrequest refused\n' });
    expect(parseCommandFindings({ check }, result, { cwd: sandbox.path, root: sandbox.path }).note).toBe(
        `${check.id} failed with exit 2:\nscan log\nrequest refused\n{"Results":[]} This check needs network access.`,
    );
});

test.each(CRASH_TAIL_CASES)(
    'a crash tail keeps the cause and hides stack frames: $name',
    ({ stdout, stderr, expected, verbose }) => {
        expect(formatOutputTail({ stdout, stderr })).toBe(expected);
        expect(formatOutputTail({ stdout, stderr }, '', { verbose: true })).toBe(verbose);
    },
);

test('astro check reads a TypeScript diagnostic from colored output, and its crash note holds no color codes', async () => {
    await using sandbox = await testdir({ 'src/env.ts': "export const count: number = 'three';\n" });
    const check = readConfigurations()
        .get('astro')!
        .checks.find((each) => each.id === 'astro/astro-check')!;
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const reported = parseCommandFindings(
        { check },
        buildProcessResult({ code: 1, stdout: ASTRO_CHECK_OUTPUT }),
        paths,
    );
    expect(reported.findings).toMatchObject([
        {
            file: 'src/env.ts',
            line: 1,
            column: 14,
            rule: 'ts(2322)',
            message: TYPE_ERROR_MESSAGE,
        },
    ]);
    const crashed = parseCommandFindings(
        { check },
        buildProcessResult({ code: 1, stdout: ASTRO_CHECK_SUMMARY }),
        paths,
    );
    expect(crashed).toStrictEqual({ note: 'astro/astro-check failed with exit 1:\nResult (1 file): \n- 1 error' });
});
