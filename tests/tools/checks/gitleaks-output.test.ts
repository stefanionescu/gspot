import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { testKeyId, testApiToken } from '#tests/config/harness/secrets.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/check.ts';
import { TEST_SECRETS, CORRECTED_SECRETS } from '#tests/config/tools/checks/gitleaks-output.ts';

async function prepareSecrets(root: string, environment: Record<string, string>): Promise<void> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['secrets'], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

// All three native scan modes must preserve both findings, usable columns, and redaction.
function expectSecretFindings(check: CheckResult | undefined, output: string): void {
    expect(check?.status).toBe('failed');
    expect(
        check?.findings
            .map(({ file, rule, line }) => ({ file, rule, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([
        { file: 'credential,é.py', rule: 'generic-api-key', line: 1 },
        { file: 'identity.py', rule: 'aws-access-token', line: 1 },
    ]);
    expect(check?.findings.every(({ column }) => column !== undefined && column > 0)).toBe(true);
    for (const token of [testKeyId, testApiToken]) expect(output).not.toContain(token);
}

test(
    'native file reports retain mixed redacted rules and comma filenames and accept corrected files',
    async () => {
        await using sandbox = await testdir();
        const environment = { PATH: buildToolsPath(['gitleaks']) };
        await prepareSecrets(sandbox.path, environment);
        await createFileTree(sandbox.path, TEST_SECRETS);
        const files = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'secrets/gitleaks-files', '--json'],
            environment,
        );
        expect(files.code, files.stdout + files.stderr).toBe(1);
        expectSecretFindings((JSON.parse(files.stdout) as RunReport).checks[0], files.stdout + files.stderr);
        await createFileTree(sandbox.path, CORRECTED_SECRETS);
        const cleanFiles = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'secrets/gitleaks-files', '--json'],
            environment,
        );
        expect(cleanFiles.code, cleanFiles.stdout + cleanFiles.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'native staged reports retain mixed redacted rules and comma filenames and accept the corrected index',
    async () => {
        await using sandbox = await testdir();
        const environment = { PATH: buildToolsPath(['gitleaks']) };
        await prepareSecrets(sandbox.path, environment);
        await createFileTree(sandbox.path, CORRECTED_SECRETS);
        commitAll(sandbox.path);
        await createFileTree(sandbox.path, TEST_SECRETS);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const staged = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'secrets/gitleaks-staged', '--json'],
            environment,
        );
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        expectSecretFindings((JSON.parse(staged.stdout) as RunReport).checks[0], staged.stdout + staged.stderr);
        await createFileTree(sandbox.path, CORRECTED_SECRETS);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const corrected = await spawnGspot(
            sandbox.path,
            ['check', '--only', 'secrets/gitleaks-staged', '--json'],
            environment,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'native history reports retain mixed redacted rules and comma filenames only in the selected commits',
    async () => {
        await using sandbox = await testdir();
        const environment = { PATH: buildToolsPath(['gitleaks']) };
        await prepareSecrets(sandbox.path, environment);
        await createFileTree(sandbox.path, CORRECTED_SECRETS);
        commitAll(sandbox.path);
        const base = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        await createFileTree(sandbox.path, TEST_SECRETS);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'feat: settings']).code).toBe(0);
        const leaked = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        await createFileTree(sandbox.path, CORRECTED_SECRETS);
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(git(sandbox.path, ['commit', '-qm', 'fix: remove settings']).code).toBe(0);
        const removed = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-history', '--json'];
        const history = await spawnGspot(sandbox.path, command, environment, {
            stdin: `refs/heads/main ${removed} refs/heads/main ${base}\n`,
        });
        expect(history.code, history.stdout + history.stderr).toBe(1);
        expectSecretFindings(
            (JSON.parse(history.stdout) as PushReport).revisions[0]?.report.checks[0],
            history.stdout + history.stderr,
        );
        const corrected = await spawnGspot(sandbox.path, command, environment, {
            stdin: `refs/heads/main ${removed} refs/heads/main ${leaked}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
