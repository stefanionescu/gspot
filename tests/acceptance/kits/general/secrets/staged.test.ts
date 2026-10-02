// Planted repository for the secrets configuration: a staged key and a baseline with no reason, on one install.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { runPlanted } from '#tests/harness/planted/cases.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { PLANTED_KEY_ID, PLANTED_SETTINGS, prepareStagedSecrets } from '#tests/harness/planted/secrets.ts';

const BASELINE = JSON.stringify([
    { Fingerprint: 'old.py:aws-access-token:1', File: 'old.py', RuleID: 'aws-access-token' },
    { Fingerprint: 'abc123:gone.md:generic-api-key:4', File: 'gone.md', RuleID: 'generic-api-key', Commit: 'abc123' },
]);

// A staged key fails without exposing the credential, and corrected indexed content passes.
async function expectStagedSecret(root: string, environment: Record<string, string>): Promise<void> {
    await Bun.write(join(root, 'settings.py'), PLANTED_SETTINGS);
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
    expect(staged.stdout).not.toContain(PLANTED_KEY_ID);

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

// An unexplained secret baseline fails, documented reasons pass, and network verification stays off.
async function expectExplainedBaseline(root: string, environment: Record<string, string>): Promise<void> {
    const baseline = await runPlanted(
        root,
        {
            check: 'secrets/gitleaks-baseline',
            files: { '.gspot/gitleaks-baseline.json': BASELINE },
        },
        environment,
    );
    expect(baseline.code).toBe(1);
    const baselineReport = JSON.parse(baseline.stdout) as RunReport;
    expect(baselineReport.checks).toMatchObject([
        {
            check: 'secrets/gitleaks-baseline',
            status: 'failed',
            findings: [
                {
                    file: '.gspot/gitleaks-baseline.json',
                    rule: 'missing-reason',
                    line: 1,
                    message: textContaining('old.py:aws-access-token:1'),
                },
                {
                    file: '.gspot/gitleaks-baseline.json',
                    rule: 'stale-entry',
                    line: 1,
                    message: textContaining('names old.py'),
                },
                {
                    file: '.gspot/gitleaks-baseline.json',
                    rule: 'missing-reason',
                    line: 1,
                    message: textContaining('abc123:gone.md:generic-api-key:4'),
                },
            ],
        },
    ]);
    const explained = await runPlanted(
        root,
        {
            check: 'secrets/gitleaks-baseline',
            files: {
                '.gspot/gitleaks-baseline.json': BASELINE,
                'old.py': '# A reviewed historical fixture.\n',
            },
            policy: '[[tools.gitleaks.baseline_reasons]]\nfingerprint = "old.py:aws-access-token:1"\nreason = "An inert documented example."\n[[tools.gitleaks.baseline_reasons]]\nfingerprint = "abc123:gone.md:generic-api-key:4"\nreason = "An inert example retained in history."\n',
        },
        environment,
    );
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    const accepted = JSON.parse(explained.stdout) as RunReport;
    expect(accepted.checks).toMatchObject([{ check: 'secrets/gitleaks-baseline', status: 'passed', findings: [] }]);
    const checked = await spawnGspot(root, ['check', '--hook', 'commit', '--json'], environment);
    const network = JSON.parse(checked.stdout) as RunReport;
    expect(network.checks.map((check) => check.check)).not.toContain('secrets/trufflehog');
}

test(
    'staged secrets and the gitleaks baseline fail and accept corrections on one install',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareStagedSecrets(sandbox.path);
        const clean = await spawnGspot(sandbox.path, ['check', '--hook', 'commit'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        await expectStagedSecret(sandbox.path, environment);
        await expectExplainedBaseline(sandbox.path, environment);
    },
    PLANTED_TIMEOUT_MS * 3,
);
