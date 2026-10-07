import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { CHECKS } from '#cli/checks/registry.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { BROKEN, CORRECTED } from '#tests/config/cli/execution/policy-findings.ts';

const POLICY_FINDINGS_OPTIONS = buildRunOptions({ only: ['swift/trivial-functions'] });

test('a wrong entry in gspot.toml is a finding of gspot/policy, and the other checks still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': BROKEN,
        'Sources/Welcome.swift': 'func welcome(for name: String) -> String { return greeting(for: name) }\n',
        '.gitignore': '.gspot/\n',
    });
    const broken = await executeRun(await openSession(sandbox.path), { ...POLICY_FINDINGS_OPTIONS, checks: CHECKS });
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['swift/trivial-functions', 'failed'],
        ['gspot/policy', 'failed'],
    ]);
    expect(broken.report.checks[1]!.findings).toMatchObject([
        {
            file: 'gspot.toml',
            message: textContaining('ignore.0.reason: [[ignore]] (swift/trivial-functions) needs a reason.'),
        },
    ]);
    expect(broken.report.failed).toContain('gspot/policy');
    writeFileSync(join(sandbox.path, 'gspot.toml'), CORRECTED);
    const corrected = await executeRun(await openSession(sandbox.path), { ...POLICY_FINDINGS_OPTIONS, checks: CHECKS });
    expect(corrected.report.checks.map((check) => check.check)).toStrictEqual(['swift/trivial-functions']);
});

test('apply refuses a policy with a wrong entry, because it writes from the policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BROKEN, '.gitignore': '.gspot/\n' });
    const session = await openSession(sandbox.path);
    {
        using log = openOwnership(session.root);
        expect(() => writeOutputs(session, log)).toThrow('gspot.toml: ignore.0.reason:');
    }
});
