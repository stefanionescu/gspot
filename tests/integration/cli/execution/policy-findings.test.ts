import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { BROKEN, CORRECTED, POLICY_FINDINGS_OPTIONS } from '#tests/inputs/integration/cli/execution/execution.ts';

test('a wrong entry in gspot.toml is a finding of integrity/policy, and the other checks still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': BROKEN,
        'Sources/Welcome.swift': 'func welcome(for name: String) -> String { return greeting(for: name) }\n',
        '.gitignore': '.gspot/\n',
    });
    const broken = await executeRun(await openSession(sandbox.path), { ...POLICY_FINDINGS_OPTIONS, checks: CHECKS });
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['swift/trivial-function', 'fail'],
        ['integrity/policy', 'fail'],
    ]);
    expect(broken.report.checks[1]!.findings).toMatchObject([
        { file: 'gspot.toml', message: textContaining('ignore.0.reason: [[ignore]] entry 1') },
    ]);
    expect(broken.report.failed).toContain('integrity/policy');
    writeFileSync(join(sandbox.path, 'gspot.toml'), CORRECTED);
    const corrected = await executeRun(await openSession(sandbox.path), { ...POLICY_FINDINGS_OPTIONS, checks: CHECKS });
    expect(corrected.report.checks.map((check) => check.check)).toStrictEqual(['swift/trivial-function']);
});

test('apply refuses a policy with a wrong entry, because it writes from the policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BROKEN, '.gitignore': '.gspot/\n' });
    const session = await openSession(sandbox.path);
    expect(await rejection(writeOutputs(session))).toContain('gspot.toml: ignore.0.reason:');
});
