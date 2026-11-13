import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { TOOL_PATTERN_CASES } from '#tests/config/engine/tool-runs.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test.each(TOOL_PATTERN_CASES)(
    '$check reports actionable output and ignores summary lines',
    async ({ check: id, code, output, expected }) => {
        const located = expected.filter(({ file }) => file !== '');
        await using sandbox = await testdir(Object.fromEntries(located.map(({ file }) => [file, ''])));
        const check = getShippedCheck(id);
        const shippedMessage = check.output.format === 'regex' ? (check.output.message ?? '') : '';
        expect(
            parseCommandFindings(
                { check },
                buildProcessResult({ code, stdout: output }),
                {
                    root: sandbox.path,
                    cwd: sandbox.path,
                },
                {},
            ),
        ).toStrictEqual({
            findings: expected.map((finding) => ({
                message: shippedMessage,
                ...finding,
                check: id,
            })),
        });
    },
);
