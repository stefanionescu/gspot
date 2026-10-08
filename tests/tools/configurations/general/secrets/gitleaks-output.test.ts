import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { testKeyId, testApiToken } from '#tests/config/samples/secrets.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/check.ts';
import type { GitleaksHistory } from '#tests/types/tools/configurations/general/secrets.ts';

import {
    FILE_SCOPES,
    TEST_SECRETS,
    FILE_EXPIRIES,
    CORRECTED_SECRETS,
} from '#tests/config/tools/configurations/general/secrets/gitleaks-output.ts';

async function prepareSecrets(root: string, environment: Record<string, string>): Promise<void> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['secrets'], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

async function prepareHistory(root: string, environment: Record<string, string>): Promise<GitleaksHistory> {
    await prepareSecrets(root, environment);
    await createFileTree(root, CORRECTED_SECRETS);
    commitAll(root);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, TEST_SECRETS);
    expect(git(root, ['add', '-A']).code).toBe(0);
    expect(git(root, ['commit', '-qm', 'feat: settings']).code).toBe(0);
    const leaked = gitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, CORRECTED_SECRETS);
    expect(git(root, ['add', '-A']).code).toBe(0);
    expect(git(root, ['commit', '-qm', 'fix: remove settings']).code).toBe(0);
    const removed = gitOutput(root, ['rev-parse', 'HEAD']);
    return { base, leaked, removed };
}

// All three native scan modes must preserve both findings, usable columns, and redaction.
function expectSecretFindings(check: CheckResult | undefined, output: string, prefix: string): void {
    expect(check?.status).toBe('failed');
    expect(
        check?.findings
            .map(({ file, rule, line }) => ({ file, rule, line }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([
        { file: 'credential,é.py', rule: `${prefix}credential,é.py:generic-api-key:1`, line: 1 },
        { file: 'identity.py', rule: `${prefix}identity.py:aws-access-token:1`, line: 1 },
    ]);
    expect(check?.findings.every(({ column }) => column !== undefined && column > 0)).toBe(true);
    for (const token of [testKeyId, testApiToken]) expect(output).not.toContain(token);
}

test('native file reports retain mixed redacted rules and comma filenames and pass after the fix', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: buildToolsPath(['gitleaks']) };
    await prepareSecrets(sandbox.path, environment);
    await createFileTree(sandbox.path, TEST_SECRETS);
    const files = await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-files', '--json'], environment);
    expect(files.code, files.stdout + files.stderr).toBe(1);
    expectSecretFindings((JSON.parse(files.stdout) as RunReport).checks[0], files.stdout + files.stderr, '');
    await createFileTree(sandbox.path, CORRECTED_SECRETS);
    const cleanFiles = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-files', '--json'],
        environment,
    );
    expect(cleanFiles.code, cleanFiles.stdout + cleanFiles.stderr).toBe(0);
});

test('native staged reports retain mixed redacted rules and comma filenames and pass after the fix', async () => {
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
    expectSecretFindings((JSON.parse(staged.stdout) as RunReport).checks[0], staged.stdout + staged.stderr, '');
    await createFileTree(sandbox.path, CORRECTED_SECRETS);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-staged', '--json'],
        environment,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('native history reports retain mixed redacted rules and comma filenames only in the selected commits', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: buildToolsPath(['gitleaks']) };
    const { base, leaked, removed } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-history', '--json'];
    const history = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${removed} refs/heads/main ${base}\n`,
    });
    expect(history.code, history.stdout + history.stderr).toBe(1);
    expectSecretFindings(
        (JSON.parse(history.stdout) as PushReport).revisions[0]?.report.checks[0],
        history.stdout + history.stderr,
        `${leaked}:`,
    );
    const corrected = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${removed} refs/heads/main ${leaked}\n`,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('native history accepts only the exact reviewed fingerprints without disclosing either token', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: buildToolsPath(['gitleaks']) };
    const { base, leaked } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-history', '--json'];
    const policy = buildPolicy(['secrets'], { tables: '[agent_rules]\nenabled = false\n' });
    const identityIgnore = `\n[[ignore]]\ncheck = "secrets/gitleaks-history"\nrule = "${leaked}:identity.py:aws-access-token:1"\nreason = "The exact historical token is an inert example."\n`;
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy + identityIgnore);
    gitOutput(sandbox.path, ['add', 'gspot.toml']);
    gitOutput(sandbox.path, ['commit', '-qm', 'docs: review historical token']);
    const reviewedRevision = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const reviewed = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${reviewedRevision} refs/heads/main ${base}\n`,
    });
    expect(reviewed.code, reviewed.stdout + reviewed.stderr).toBe(1);
    const findings = (JSON.parse(reviewed.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings;
    expect(findings?.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: 'credential,é.py', rule: `${leaked}:credential,é.py:generic-api-key:1`, line: 1 },
    ]);
    for (const token of [testKeyId, testApiToken]) expect(reviewed.stdout + reviewed.stderr).not.toContain(token);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        policy +
            identityIgnore +
            `\n[[ignore]]\ncheck = "secrets/gitleaks-history"\nrule = "${leaked}:credential,é.py:generic-api-key:1"\nreason = "The other exact historical token is an inert example."\n`,
    );
    gitOutput(sandbox.path, ['add', 'gspot.toml']);
    gitOutput(sandbox.path, ['commit', '-qm', 'docs: review other historical token']);
    const acceptedRevision = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const accepted = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${acceptedRevision} refs/heads/main ${base}\n`,
    });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings).toStrictEqual([]);
});

test.each(FILE_SCOPES)(
    'native %s file fingerprints retain exact ignores in a no-Git scratch copy',
    async (_name, folder) => {
        await using sandbox = await testdir();
        const environment = { PATH: buildToolsPath(['gitleaks']) };
        const tables =
            '[agent_rules]\nenabled = false\n' + (folder === '' ? '' : '[scope.app]\nconfigurations = ["secrets"]\n');
        const policy = buildPolicy(['secrets'], { tables });
        await createFileTree(sandbox.path, { 'gspot.toml': policy });
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await createFileTree(
            sandbox.path,
            Object.fromEntries(Object.entries(TEST_SECRETS).map(([file, text]) => [folder + file, text])),
        );
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            policy +
                `\n[[ignore]]\ncheck = "secrets/gitleaks-files"\nrule = "${folder}identity.py:aws-access-token:1"\npaths = ["${folder}identity.py"]\nreason = "This exact inert token is a reviewed example."\n`,
        );
        using copied = await copyIntoScratch({
            root: sandbox.path,
            dependencies: [],
            paths: [
                'gspot.toml',
                '.gspot/config/gitleaks.toml',
                ...Object.keys(TEST_SECRETS).map((file) => folder + file),
            ],
        });
        for (const root of [sandbox.path, copied.path]) {
            const checked = await spawnGspot(
                root,
                ['check', '--only', 'secrets/gitleaks-files', '--json'],
                environment,
            );
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
                {
                    check: 'secrets/gitleaks-files',
                    status: 'failed',
                    findings: [
                        {
                            file: `${folder}credential,é.py`,
                            rule: `${folder}credential,é.py:generic-api-key:1`,
                            line: 1,
                        },
                    ],
                },
            ]);
            expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toHaveLength(1);
            for (const token of [testKeyId, testApiToken]) expect(checked.stdout + checked.stderr).not.toContain(token);
        }
    },
);

test.each(FILE_EXPIRIES)('native file findings respect an %s fingerprint expiry', async (_name, until, expected) => {
    await using sandbox = await testdir();
    const environment = { PATH: buildToolsPath(['gitleaks']) };
    await prepareSecrets(sandbox.path, environment);
    await createFileTree(sandbox.path, TEST_SECRETS);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['secrets'], {
            tables: `[agent_rules]\nenabled = false\n[[ignore]]\ncheck = "secrets/gitleaks-files"\nrule = "identity.py:aws-access-token:1"\nuntil = ${until}\nreason = "The exact inert token has a reviewed expiry."\n`,
        }),
    );
    const checked = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-files', '--json'],
        environment,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        (JSON.parse(checked.stdout) as RunReport).checks[0]?.findings.map(({ rule }) => rule).toSorted(),
    ).toStrictEqual([...expected]);
    for (const token of [testKeyId, testApiToken]) expect(checked.stdout + checked.stderr).not.toContain(token);
});
