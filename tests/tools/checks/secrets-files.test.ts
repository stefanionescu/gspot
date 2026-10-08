// Without git the secrets configuration scans the files themselves, and the git scans wait for a repository.
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { testApiToken } from '#tests/config/samples/secrets.ts';
import type { RunReport, RunOptions } from '#cli/types/execution/check.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

const SECRETS_FILES_POLICY = buildPolicy(['secrets'], { tables: '[agent_rules]\nenabled = false\n' });

async function secretChecks(root: string): Promise<RunReport['checks']> {
    const options: RunOptions = buildRunOptions();
    const outcome = await executeRun(await openSession(root), options);
    return outcome.report.checks.filter((check) => check.check.startsWith('secrets/'));
}

test('a folder with no git scans its files for secrets, and a git repository scans its changes instead', async () => {
    if (Bun.which('gitleaks') === null) throw new Error('The native secrets test requires gitleaks.');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SECRETS_FILES_POLICY,
        'src/config.js': `const token = "${testApiToken}";\n`,
    });
    {
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(await openSession(sandbox.path), log);
    }
    const withoutGit = await secretChecks(sandbox.path);
    expect(withoutGit).toContainEqual(
        containing({
            check: 'secrets/gitleaks-files',
            status: 'failed',
            findings: containingAll([containing({ file: 'src/config.js' })]),
        }),
    );
    expect(withoutGit.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('skipped');
    commitAll(sandbox.path);
    const isGitRepository = await secretChecks(sandbox.path);
    expect(isGitRepository.find((check) => check.check === 'secrets/gitleaks-files')?.status).toBe('skipped');
    expect(isGitRepository.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('passed');
});
