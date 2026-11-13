import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { compareText } from '#cli/system/text/order.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import { API_TOKEN } from '#tests/config/integration/general.ts';
import { pushOutputSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import type { GitleaksHistory } from '#tests/types/integration.ts';

const AWS_KEY_ID = ['AKIA', 'IOSFODNN7', 'EXAMPLA'].join('');

const AWS_CREDENTIALS = `aws_access_key_id = "${AWS_KEY_ID}"\n`;

const SECRET_FILES = {
    'credential,é.py': `api_key = "${API_TOKEN}"\n`,
    'identity.py': AWS_CREDENTIALS,
} as const;

const FIXED_SECRET_FILES = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
} as const;

const DOTENV_LINTER_SAMPLE = {
    check: 'secrets/dotenv-linter',
    files: {
        '.env.example': 'PORT=3000\nsecret_key=example\n',
    },
    expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
    corrected: { files: { '.env.example': 'PORT=3000\n' } },
} as const;

async function prepareSecrets(root: string): Promise<void> {
    runGitStep(root, ['init', '-q']);
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['secrets']) });
    await applyGeneratedFiles(root);
}

async function prepareHistory(root: string): Promise<GitleaksHistory> {
    await prepareSecrets(root);
    await createFileTree(root, FIXED_SECRET_FILES);
    commitAll(root);
    const base = runGitStep(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, SECRET_FILES);
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '-qm', 'feat: settings']);
    const leaked = runGitStep(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, FIXED_SECRET_FILES);
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '-qm', 'fix: remove settings']);
    const removed = runGitStep(root, ['rev-parse', 'HEAD']);
    return { base, leaked, removed };
}

function assertSecretFindings(result: CheckResult | undefined, output: string, prefix: string): void {
    expect(result?.status).toBe('failed');
    expect(
        result?.findings
            .map(({ file, rule, fingerprint, line, column }) => ({ file, rule, fingerprint, line, column }))
            .toSorted((left, right) => compareText(left.file, right.file)),
    ).toStrictEqual([
        {
            file: 'credential,é.py',
            rule: 'generic-api-key',
            fingerprint: `${prefix}credential,é.py:generic-api-key:1`,
            line: 1,
            column: 1,
        },
        {
            file: 'identity.py',
            rule: 'aws-access-token',
            fingerprint: `${prefix}identity.py:aws-access-token:1`,
            line: 1,
            column: 22,
        },
    ]);
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(output).not.toContain(token);
}

test('secrets/gitleaks-staged reports a committed secret in a full check, and only a staged one with --staged', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['secrets']),
        'src/config.js': `const token = "${API_TOKEN}";\n`,
    });
    commitAll(sandbox.path);

    await applyGeneratedFiles(sandbox.path);
    const everyFile = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-staged', '--json']),
    ).report.checks;
    expect(everyFile).toMatchObject([
        { check: 'secrets/gitleaks-staged', status: 'failed', findings: [{ file: 'src/config.js' }] },
    ]);
    const command = ['check', '--staged', '--only', 'secrets/gitleaks-staged', '--json'];
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, { 'src/staged.js': `const token = "${API_TOKEN}";\n` });
    runGitStep(sandbox.path, ['add', 'src/staged.js']);
    const staged = parseCheckReport(await spawnGspot(sandbox.path, command)).report.checks;
    expect(staged).toMatchObject([
        { check: 'secrets/gitleaks-staged', status: 'failed', findings: [{ file: 'src/staged.js' }] },
    ]);
});

test('a full secrets scan follows what Git lists: a forced file reports, and an excluded file does not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['secrets']),
        '.gitignore': 'dist/\n',
        'src/value.js': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git/info/exclude'), 'local/\n');
    const secret = `const token = "${API_TOKEN}";\n`;
    await createFileTree(sandbox.path, { 'dist/forced.js': secret, 'local/excluded.js': secret });
    runGitStep(sandbox.path, ['add', '-f', 'dist/forced.js']);
    await applyGeneratedFiles(sandbox.path);
    const { report } = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-staged', '--json']),
    );
    expect(report.checks).toMatchObject([{ status: 'failed', findings: [{ file: 'dist/forced.js' }] }]);
});

test('gitleaks reports both staged secrets, hides the tokens, and passes after the fix', async () => {
    await using sandbox = await testdir();
    await prepareSecrets(sandbox.path);
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, SECRET_FILES);
    runGitStep(sandbox.path, ['add', '-A']);
    const staged = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-staged', '--json']),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    assertSecretFindings(staged.report.checks[0], staged.stdout + staged.stderr, '');
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    runGitStep(sandbox.path, ['add', '-A']);
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-staged', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('secrets/gitleaks-pushed reports the secrets of the pushed commits only', async () => {
    await using sandbox = await testdir();
    const { base, leaked, removed } = await prepareHistory(sandbox.path);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
    const history = await spawnGspot(
        sandbox.path,
        command,
        {},
        {
            stdin: `refs/heads/main ${removed} refs/heads/main ${base}\n`,
        },
    );
    expect(history.code, history.stdout + history.stderr).toBe(1);
    assertSecretFindings(
        pushOutputSchema.parse(JSON.parse(history.stdout)).revisions[0]?.report.checks[0],
        history.stdout + history.stderr,
        `${leaked}:`,
    );
    const corrected = await spawnGspot(
        sandbox.path,
        command,
        {},
        {
            stdin: `refs/heads/main ${removed} refs/heads/main ${leaked}\n`,
        },
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('secrets/gitleaks-pushed drops a finding only when an ignore names its exact fingerprint, and never prints a token', async () => {
    await using sandbox = await testdir();
    const { base, leaked } = await prepareHistory(sandbox.path);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
    const settings = buildSandboxSettings(['secrets']);
    const identityIgnore = {
        check: 'secrets/gitleaks-pushed',
        rule: `${leaked}:identity.py:aws-access-token:1`,
        reason: 'The exact historical token is an inert example.',
    };
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + stringify({ ignore: [identityIgnore] }));
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    runGitStep(sandbox.path, ['commit', '-qm', 'docs: review historical token']);
    const reviewedRevision = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const reviewed = await spawnGspot(
        sandbox.path,
        command,
        {},
        {
            stdin: `refs/heads/main ${reviewedRevision} refs/heads/main ${base}\n`,
        },
    );
    expect(reviewed.code, reviewed.stdout + reviewed.stderr).toBe(1);
    const findings = pushOutputSchema.parse(JSON.parse(reviewed.stdout)).revisions[0]?.report.checks[0]?.findings;
    expect(findings?.map(({ file, rule, fingerprint, line }) => ({ file, rule, fingerprint, line }))).toStrictEqual([
        {
            file: 'credential,é.py',
            rule: 'generic-api-key',
            fingerprint: `${leaked}:credential,é.py:generic-api-key:1`,
            line: 1,
        },
    ]);
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(reviewed.stdout + reviewed.stderr).not.toContain(token);
    const credentialIgnore = {
        check: 'secrets/gitleaks-pushed',
        rule: `${leaked}:credential,é.py:generic-api-key:1`,
        reason: 'The other exact historical token is an inert example.',
    };
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        settings + stringify({ ignore: [identityIgnore, credentialIgnore] }),
    );
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    runGitStep(sandbox.path, ['commit', '-qm', 'docs: review other historical token']);
    const acceptedRevision = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const accepted = await spawnGspot(
        sandbox.path,
        command,
        {},
        {
            stdin: `refs/heads/main ${acceptedRevision} refs/heads/main ${base}\n`,
        },
    );
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(pushOutputSchema.parse(JSON.parse(accepted.stdout)).revisions[0]?.report.checks[0]?.findings).toStrictEqual(
        [],
    );
});

const installedSandbox = shareInstalledSandbox({
    install: false,
    configurations: ['secrets'],
    files: { '.env.example': 'PORT=3000\n' },
});

test('secrets/dotenv-linter reports .env.example and passes after the fix', async () => {
    await assertCheckSample(installedSandbox(), DOTENV_LINTER_SAMPLE);
});
