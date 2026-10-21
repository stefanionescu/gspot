import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { type PushReport } from '#cli/types/commands/check.ts';
import { type GitleaksHistory } from '#tests/types/secrets.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { type RunReport, type CheckResult } from '#cli/types/runs/check.ts';
import { API_TOKEN, AWS_KEY_ID, SECRET_FILES, FIXED_SECRET_FILES } from '#tests/data/checks/secrets.ts';

async function readSecretChecks(root: string): Promise<RunReport['checks']> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'secrets/gitleaks-staged', '--json']));
    return result.report.checks;
}

test('the staged scan skips a folder without Git and checks staged changes once Git exists', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['secrets']),
        'src/config.js': `const token = "${API_TOKEN}";\n`,
    });

    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const withoutGit = await readSecretChecks(sandbox.path);
    expect(withoutGit.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('skipped');
    commitAll(sandbox.path);
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const committed = await readSecretChecks(sandbox.path);
    expect(committed.find((check) => check.check === 'secrets/gitleaks-staged')?.status).toBe('passed');
    await createFileTree(sandbox.path, { 'src/staged.js': `const token = "${API_TOKEN}";\n` });
    readGitOutput(sandbox.path, ['add', 'src/staged.js']);
    const staged = await readSecretChecks(sandbox.path);
    expect(staged).toContainEqual(
        matchFields({
            check: 'secrets/gitleaks-staged',
            status: 'failed',
            findings: matchItems([matchFields({ file: 'src/staged.js' })]),
        }),
    );
});

async function prepareSecrets(root: string, environment: Record<string, string>): Promise<void> {
    readGitOutput(root, ['init', '-q']);
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['secrets']),
    });
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

async function prepareHistory(root: string, environment: Record<string, string>): Promise<GitleaksHistory> {
    await prepareSecrets(root, environment);
    await createFileTree(root, FIXED_SECRET_FILES);
    commitAll(root);
    const base = readGitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, SECRET_FILES);
    expect(runGit(root, ['add', '-A']).code).toBe(0);
    expect(runGit(root, ['commit', '-qm', 'feat: settings']).code).toBe(0);
    const leaked = readGitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, FIXED_SECRET_FILES);
    expect(runGit(root, ['add', '-A']).code).toBe(0);
    expect(runGit(root, ['commit', '-qm', 'fix: remove settings']).code).toBe(0);
    const removed = readGitOutput(root, ['rev-parse', 'HEAD']);
    return { base, leaked, removed };
}

// Each of the three scan modes must keep both findings, usable columns, and redaction.
function assertSecretFindings(check: CheckResult | undefined, output: string, prefix: string): void {
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
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(output).not.toContain(token);
}

test('gitleaks reports both staged secrets, hides the tokens, and passes after the fix', async () => {
    await using sandbox = await testdir();
    const environment = {};
    await prepareSecrets(sandbox.path, environment);
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, SECRET_FILES);
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    const staged = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-staged', '--json'], environment),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    assertSecretFindings(staged.report.checks[0], staged.stdout + staged.stderr, '');
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-staged', '--json'],
        environment,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('the pushed-history check reports the secrets of the pushed commits only', async () => {
    await using sandbox = await testdir();
    const environment = {};
    const { base, leaked, removed } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
    const history = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${removed} refs/heads/main ${base}\n`,
    });
    expect(history.code, history.stdout + history.stderr).toBe(1);
    assertSecretFindings(
        (JSON.parse(history.stdout) as PushReport).revisions[0]?.report.checks[0],
        history.stdout + history.stderr,
        `${leaked}:`,
    );
    const corrected = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${removed} refs/heads/main ${leaked}\n`,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('the pushed-history check passes only the ignored fingerprints and never prints a token', async () => {
    await using sandbox = await testdir();
    const environment = {};
    const { base, leaked } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
    const settings = buildSandboxSettings(['secrets']);
    const identityIgnore = `
[[ignore]]
check = "secrets/gitleaks-pushed"
rule = "${leaked}:identity.py:aws-access-token:1"
reason = "The exact historical token is an inert example."
`;
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + identityIgnore);
    readGitOutput(sandbox.path, ['add', 'gspot.toml']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'docs: review historical token']);
    const reviewedRevision = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const reviewed = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${reviewedRevision} refs/heads/main ${base}\n`,
    });
    expect(reviewed.code, reviewed.stdout + reviewed.stderr).toBe(1);
    const findings = (JSON.parse(reviewed.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings;
    expect(findings?.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: 'credential,é.py', rule: `${leaked}:credential,é.py:generic-api-key:1`, line: 1 },
    ]);
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(reviewed.stdout + reviewed.stderr).not.toContain(token);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        settings +
            identityIgnore +
            `
[[ignore]]
check = "secrets/gitleaks-pushed"
rule = "${leaked}:credential,é.py:generic-api-key:1"
reason = "The other exact historical token is an inert example."
`,
    );
    readGitOutput(sandbox.path, ['add', 'gspot.toml']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'docs: review other historical token']);
    const acceptedRevision = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const accepted = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${acceptedRevision} refs/heads/main ${base}\n`,
    });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings).toStrictEqual([]);
});
