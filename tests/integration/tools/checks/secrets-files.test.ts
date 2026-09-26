// Without git the secrets configuration scans the files themselves, and the git scans wait for a repository (K-271).
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import type { RunOptions } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { PLANTED_TOKEN, SECRETS_FILES_POLICY } from '#tests/constants/integration/tools/checks.ts';

async function secretChecks(root: string): Promise<{ check: string; status: string; findings: { file: string }[] }[]> {
    const options: RunOptions = { stage: 'all', skips: [], fix: false, isDryRun: false, noCache: true };
    const outcome = await executeRun(await openSession(root), options);
    return outcome.report.checks
        .filter((check) => check.check.startsWith('secrets/'))
        .map((check) => ({ check: check.check, status: check.status, findings: check.findings }));
}

test('a folder with no git scans its files for secrets, and a git repository scans its changes instead', async () => {
    if (Bun.which('gitleaks') === null) throw new Error('The native secrets test requires gitleaks.');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': SECRETS_FILES_POLICY, 'src/config.js': PLANTED_TOKEN });
    await applyAll(await openSession(sandbox.path));
    const withoutGit = await secretChecks(sandbox.path);
    expect(withoutGit).toContainEqual(
        containing({
            check: 'secrets/gitleaks-files',
            status: 'fail',
            findings: [containing({ file: 'src/config.js' })],
        }),
    );
    expect(withoutGit.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('skipped');
    const options: RunOptions = { stage: 'all', skips: [], fix: false, isDryRun: false, noCache: true };
    const { planned } = await executeRun(await openSession(sandbox.path), options);
    expect(planned.find((check) => check.check === 'secrets/gitleaks-staged')?.skip).toMatchObject({
        source: 'rules',
        note: textContaining('no git repository'),
    });
    commitAll(sandbox.path);
    const withGit = await secretChecks(sandbox.path);
    expect(withGit.find((check) => check.check === 'secrets/gitleaks-files')?.status).toBe('skipped');
    expect(withGit.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('ok');
});
