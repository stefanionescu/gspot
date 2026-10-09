// Shipped Bash defaults report unused functions and unnamed SSH heredocs without hiding other findings.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { commitAll, markExecutable } from '#tests/harness/git.ts';
import { ONLY, SCRIPT } from '#tests/config/cli/checks/language/bash/conventions.ts';

test('shipped entry and SSH defaults report every finding and accept the declared call and heredoc', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'deploy.sh': SCRIPT,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'deploy.sh');
    const options = buildRunOptions({ only: ONLY });
    const run = await executeRun(await openSession(sandbox.path), options);
    expect(run.report.exitCode).toBe(1);
    const findings = run.report.checks.flatMap(({ findings }) => findings);
    expect(findings).toMatchObject([
        { check: 'bash/unused-functions', file: 'deploy.sh', line: 9, rule: 'never-called' },
        { check: 'bash/ssh-blocks', file: 'deploy.sh', line: 13, rule: 'undocumented-block' },
    ]);
    expect(findings).toHaveLength(2);
    const corrected = SCRIPT.replace('    echo "$1"', () => '    run_step "$1"').replace(
        'ssh "$1"',
        () => '# restart_remote: restarts the remote service.\nssh "$1"',
    );
    await Bun.write(join(sandbox.path, 'deploy.sh'), corrected);
    const accepted = await executeRun(await openSession(sandbox.path), options);
    expect(accepted.report.exitCode).toBe(0);
    expect(accepted.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
