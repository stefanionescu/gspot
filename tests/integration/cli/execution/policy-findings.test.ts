import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection, textContaining } from '#tests/support/expectations.ts';
import { BROKEN, CORRECTED, POLICY_FINDINGS_OPTIONS } from '#tests/constants/integration/cli/execution/execution.ts';

test('a wrong line in gspot.toml is a finding of integrity/policy, and the other checks still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': BROKEN,
        'Sources/Welcome.swift': 'func welcome(for name: String) -> String { return greeting(for: name) }\n',
        '.gitignore': '.gspot/\n',
    });
    const broken = await executeRun(await openSession(sandbox.path), POLICY_FINDINGS_OPTIONS);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['swift/trivial-function', 'fail'],
        ['integrity/policy', 'fail'],
    ]);
    expect(broken.report.checks[1]!.findings).toMatchObject([
        { file: 'gspot.toml', line: 5, column: 1, message: textContaining('needs a reason') },
    ]);
    expect(broken.report.failed).toContain('integrity/policy');
    writeFileSync(join(sandbox.path, 'gspot.toml'), CORRECTED);
    const corrected = await executeRun(await openSession(sandbox.path), POLICY_FINDINGS_OPTIONS);
    expect(corrected.report.checks.map((check) => check.check)).toStrictEqual(['swift/trivial-function']);
});

test('apply refuses a policy with a wrong line, because it writes from the policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BROKEN, '.gitignore': '.gspot/\n' });
    const session = await openSession(sandbox.path);
    expect(await rejection(applyAll(session))).toContain('gspot.toml:5:1');
});
