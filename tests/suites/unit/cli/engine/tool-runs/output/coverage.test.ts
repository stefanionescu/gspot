import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { BASE_CHECK, FILELESS_COVERAGE_CASES } from '#tests/config/engine/tool-runs.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test.each(FILELESS_COVERAGE_CASES)(
    '$check exit $code reports its output line as a finding with no file',
    async ({ check: id, code, output, message }) => {
        await using sandbox = await testdir();
        const check = getShippedCheck(id);
        const parsed = parseCommandFindings(
            { check },
            buildProcessResult({ code, stdout: output }),
            {
                root: sandbox.path,
                cwd: sandbox.path,
            },
            {},
        );
        expect(parsed.findings).toStrictEqual([{ check: id, file: '', message, fixable: false }]);
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
        parseCommandFindings(
            { check },
            buildProcessResult({ code: 1, stdout: 'missing.ts:\n  1: A defect.' }),
            {
                root: sandbox.path,
                cwd: sandbox.path,
            },
            {},
        ),
    ).toStrictEqual({ note: expect.stringContaining('missing.ts:\n  1: A defect.') as string });
});

test('jest/tests reports no finding for the console output of a passing run', async () => {
    await using sandbox = await testdir();
    const check = getShippedCheck('jest/tests');
    const parsed = parseCommandFindings(
        { check },
        buildProcessResult({ code: 0, stderr: '  ● Console\n\n    console.log\n      hello\n' }),
        { root: sandbox.path, cwd: sandbox.path },
        {},
    );
    expect(parsed.findings).toStrictEqual([]);
});
