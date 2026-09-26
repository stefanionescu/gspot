import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection } from '#tests/support/rejection.ts';

const OPTIONS = { stage: 'all' as const, skips: [], only: ['swift/trivial-function'], fix: false, isDryRun: false };
const BROKEN =
    'version = 1\nlevel = "all"\nconfigurations = ["swift"]\nrequire_reasons = true\n[[ignore]]\ncheck = "swift/trivial-function"\npaths = ["Sources/Other.swift"]\n';
const CORRECTED = `${BROKEN}reason = "The protocol entry point forwards by design."\n`;

test('a wrong line in gspot.toml is a finding of integrity/policy, and the other checks still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': BROKEN,
        'Sources/Welcome.swift': 'func welcome(for name: String) -> String { return greeting(for: name) }\n',
        '.gitignore': '.gspot/\n',
    });
    const broken = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(broken.report.exitCode).toBe(1);
    expect(broken.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['swift/trivial-function', 'fail'],
        ['integrity/policy', 'fail'],
    ]);
    expect(broken.report.checks[1]!.findings).toMatchObject([
        { file: 'gspot.toml', line: 5, column: 1, message: expect.stringContaining('needs a reason') },
    ]);
    expect(broken.report.failed).toContain('integrity/policy');
    writeFileSync(join(sandbox.path, 'gspot.toml'), CORRECTED);
    const corrected = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(corrected.report.checks.map((check) => check.check)).toStrictEqual(['swift/trivial-function']);
});

test('apply refuses a policy with a wrong line, because it writes from the policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BROKEN, '.gitignore': '.gspot/\n' });
    const session = await openSession(sandbox.path);
    expect((await rejection(applyAll(session))).message).toContain('gspot.toml:5:1');
});
