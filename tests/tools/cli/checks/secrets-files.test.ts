// Without git the secrets configuration scans the files themselves, and the git scans wait for a repository.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunOptions } from '#cli/types/execution/execution.ts';

const SECRETS_FILES_POLICY = policyOf(['secrets'], '[guides]\ninstall = false\n');

/** A planted token with the shape gitleaks looks for; it belongs to nothing, and this file holds it in two parts. */
const PLANTED_TOKEN = `const token = "${['ghp', 'Xk92lM3nPq7RsT1vWy4ZaB6cDe8FgH0iJkLmN'].join('_')}";\n`;

async function secretChecks(root: string): Promise<{ check: string; status: string; findings: { file: string }[] }[]> {
    const options: RunOptions = runOptions();
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
