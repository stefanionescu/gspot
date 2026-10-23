import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SCOPE_FINDINGS, SCOPE_CHECK_FILES } from '#tests/config/runs/built-in.ts';

test.each([...SCOPE_FINDINGS])("each check in a scope reads only that scope's files: $check", async (entry) => {
    await using sandbox = await testdir(SCOPE_CHECK_FILES);

    const result = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', entry.check, '--json']));
    expect(result.code, `${entry.check}: ${result.stdout}${result.stderr}`).toBe(1);
    expect(
        result.report.checks.map(({ scope, findings }) => ({ scope, findings })),
        entry.check,
    ).toStrictEqual([
        { scope: '', findings: entry.root.map((finding) => matchFields<Finding>(finding)) },
        { scope: 'apps/backend', findings: entry.nested.map((finding) => matchFields<Finding>(finding)) },
    ]);
});
