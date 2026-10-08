// Native staged-secret scanning rejects indexed credentials and passes after the fix.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { testKeyId, secretSettings } from '#tests/config/samples/secrets.ts';
import type { SecretEnvironment } from '#tests/types/tools/configurations/general/secrets.ts';

/** Creates and commits a clean script, then installs the secrets configuration and its native tools. */
async function prepareStagedSecrets(root: string): Promise<SecretEnvironment> {
    await createFileTree(root, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(root);
    const environment = { PATH: buildToolsPath(['gitleaks']) };
    await initRepository(root, buildInitArguments(['secrets']), environment, { level: 'all' });
    expect(git(root, ['add', '-A']).code).toBe(0);
    return environment;
}

// A staged key fails without exposing the credential, and corrected indexed content passes.
async function expectStagedSecret(root: string, environment: Record<string, string>): Promise<void> {
    await Bun.write(join(root, 'settings.py'), secretSettings);
    git(root, ['add', 'settings.py']);
    const staged = await spawnGspot(root, ['check', '--only', 'secrets/gitleaks-staged', '--json'], environment);
    expect(staged.code, staged.stdout).toBe(1);
    expect((JSON.parse(staged.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'secrets/gitleaks-staged',
            status: 'failed',
            findings: [containing({ file: 'settings.py', rule: 'aws-access-token', line: 1 })],
        },
    ]);
    expect(staged.stdout).not.toContain(testKeyId);

    await Bun.write(join(root, 'settings.py'), 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n');
    expect(git(root, ['add', 'settings.py']).code).toBe(0);
    const correctedSecret = await spawnGspot(
        root,
        ['check', '--only', 'secrets/gitleaks-staged', '--json'],
        environment,
    );
    expect(correctedSecret.code, correctedSecret.stdout + correctedSecret.stderr).toBe(0);
    expect((JSON.parse(correctedSecret.stdout) as RunReport).checks).toMatchObject([
        { check: 'secrets/gitleaks-staged', status: 'passed', findings: [] },
    ]);
}

test('staged secrets fail and pass after fixes without running network verification', async () => {
    await using sandbox = await testdir();
    const environment = await prepareStagedSecrets(sandbox.path);
    const clean = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit'], environment);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    await expectStagedSecret(sandbox.path, environment);
    const checked = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const network = JSON.parse(checked.stdout) as RunReport;
    expect(network.checks.map((check) => check.check)).not.toContain('secrets/trufflehog');
});
