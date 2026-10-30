import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { TOOL_PATTERN_CASES } from '#tests/config/runs/command/output.ts';

test.each(TOOL_PATTERN_CASES)(
    '$check reports actionable output and ignores summary lines',
    async ({ check: id, code, output, expected }) => {
        await using sandbox = await testdir(Object.fromEntries(expected.map(({ file }) => [file, ''])));
        const check = getShippedCheck(id);
        expect(
            parseCommandFindings({ check }, buildProcessResult({ code, stdout: output }), {
                root: sandbox.path,
                cwd: sandbox.path,
            }),
        ).toStrictEqual({ findings: expected.map((finding) => ({ ...finding, check: id, help: check.help })) });
    },
);
