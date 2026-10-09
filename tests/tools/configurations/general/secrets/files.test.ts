// Without git the secrets configuration scans the files themselves, and the git scans wait for a repository.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { testApiToken } from '#tests/config/samples/secrets.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import type { RunReport, RunOptions } from '#cli/types/execution/check.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';

const SECRETS_FILES_POLICY = buildPolicy(['secrets']);

async function secretChecks(root: string): Promise<RunReport['checks']> {
    const options: RunOptions = buildRunOptions();
    const outcome = await executeRun(await openSession(root), options);
    return outcome.report.checks.filter((check) => check.check.startsWith('secrets/'));
}

test('a folder with no git scans its files for secrets, and a git repository scans its changes instead', async () => {
    using _tools = useEnvironment({ PATH: buildToolsPath(['gitleaks']) });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SECRETS_FILES_POLICY,
        'src/config.js': `const token = "${testApiToken}";\n`,
    });
    {
        using log = openOwnership(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
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
    const committed = await secretChecks(sandbox.path);
    expect(committed.find((check) => check.check === 'secrets/gitleaks-files')?.status).toBe('skipped');
    expect(committed.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('passed');
    await createFileTree(sandbox.path, { 'src/staged.js': `const token = "${testApiToken}";\n` });
    gitOutput(sandbox.path, ['add', 'src/staged.js']);
    const staged = await secretChecks(sandbox.path);
    expect(staged).toContainEqual(
        containing({
            check: 'secrets/gitleaks-staged',
            status: 'failed',
            findings: containingAll([containing({ file: 'src/staged.js' })]),
        }),
    );
});
