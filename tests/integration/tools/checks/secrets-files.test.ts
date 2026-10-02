// Without git the secrets configuration scans the files themselves, and the git scans wait for a repository.
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { containing } from '#tests/support/expectations.ts';
import type { RunOptions } from '#cli/types/execution/execution.ts';
import { PLANTED_TOKEN, SECRETS_FILES_POLICY } from '#tests/inputs/integration/tools/checks.ts';

async function secretChecks(root: string): Promise<{ check: string; status: string; findings: { file: string }[] }[]> {
    const options: RunOptions = { checks: CHECKS, stage: 'all', skips: [], fix: false, isDryRun: false };
    const outcome = await executeRun(await openSession(root), options);
    return outcome.report.checks
        .filter((check) => check.check.startsWith('secrets/'))
        .map((check) => ({ check: check.check, status: check.status, findings: check.findings }));
}

test('a folder with no git scans its files for secrets, and a git repository scans its changes instead', async () => {
    if (Bun.which('gitleaks') === null) throw new Error('The native secrets test requires gitleaks.');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': SECRETS_FILES_POLICY, 'src/config.js': PLANTED_TOKEN });
    await writeOutputs(await openSession(sandbox.path));
    const withoutGit = await secretChecks(sandbox.path);
    expect(withoutGit).toContainEqual(
        containing({
            check: 'secrets/gitleaks-files',
            status: 'fail',
            findings: [containing({ file: 'src/config.js' })],
        }),
    );
    expect(withoutGit.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('skipped');
    commitAll(sandbox.path);
    const isGitRepository = await secretChecks(sandbox.path);
    expect(isGitRepository.find((check) => check.check === 'secrets/gitleaks-files')?.status).toBe('skipped');
    expect(isGitRepository.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('ok');
});
