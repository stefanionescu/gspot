import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/setup/install.ts';
import { openSession } from '#cli/commands/session.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { type GitleaksHistory } from '#tests/types/secrets.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import { copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { containing, containingAll } from '#tests/setup/matchers.ts';
import { type RunReport, type CheckResult } from '#cli/types/execution/check.ts';
import { API_TOKEN, AWS_KEY_ID, SECRET_FILES, GITLEAKS_SCOPES, FIXED_SECRET_FILES } from '#tests/config/secrets.ts';

const SECRETS_FILES_POLICY = settingsText(['secrets']);

async function secretChecks(root: string): Promise<RunReport['checks']> {
    const result = await spawnGspot(root, [
        'check',
        '--only',
        'secrets/gitleaks-files',
        'secrets/gitleaks-staged',
        '--json',
    ]);
    return (JSON.parse(result.stdout) as RunReport).checks;
}

test('the secrets checks scan the files of a folder without Git, and the staged changes once Git exists', async () => {
    using _tools = useEnvironment({ PATH: toolsPath() });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SECRETS_FILES_POLICY,
        'src/config.js': `const token = "${API_TOKEN}";\n`,
    });
    {
        using log = openOwnershipLog(sandbox.path);
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
    await createFileTree(sandbox.path, { 'src/staged.js': `const token = "${API_TOKEN}";\n` });
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

async function prepareSecrets(root: string, environment: Record<string, string>): Promise<void> {
    await createFileTree(root, {
        'gspot.toml': settingsText(['secrets']),
    });
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

async function prepareHistory(root: string, environment: Record<string, string>): Promise<GitleaksHistory> {
    await prepareSecrets(root, environment);
    await createFileTree(root, FIXED_SECRET_FILES);
    commitAll(root);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, SECRET_FILES);
    expect(git(root, ['add', '-A']).code).toBe(0);
    expect(git(root, ['commit', '-qm', 'feat: settings']).code).toBe(0);
    const leaked = gitOutput(root, ['rev-parse', 'HEAD']);
    await createFileTree(root, FIXED_SECRET_FILES);
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
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(output).not.toContain(token);
}

test('gitleaks reports both secrets in files, hides the tokens, and passes after the fix', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: toolsPath() };
    await prepareSecrets(sandbox.path, environment);
    await createFileTree(sandbox.path, SECRET_FILES);
    const files = await spawnGspot(sandbox.path, ['check', '--only', 'secrets/gitleaks-files', '--json'], environment);
    expect(files.code, files.stdout + files.stderr).toBe(1);
    expectSecretFindings((JSON.parse(files.stdout) as RunReport).checks[0], files.stdout + files.stderr, '');
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    const cleanFiles = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-files', '--json'],
        environment,
    );
    expect(cleanFiles.code, cleanFiles.stdout + cleanFiles.stderr).toBe(0);
});

test('gitleaks reports both staged secrets, hides the tokens, and passes after the fix', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: toolsPath() };
    await prepareSecrets(sandbox.path, environment);
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, SECRET_FILES);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const staged = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-staged', '--json'],
        environment,
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    expectSecretFindings((JSON.parse(staged.stdout) as RunReport).checks[0], staged.stdout + staged.stderr, '');
    await createFileTree(sandbox.path, FIXED_SECRET_FILES);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'secrets/gitleaks-staged', '--json'],
        environment,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('the pushed-history check reports the secrets of the pushed commits only', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: toolsPath() };
    const { base, leaked, removed } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
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

test('the pushed-history check passes only the ignored fingerprints and never prints a token', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: toolsPath() };
    const { base, leaked } = await prepareHistory(sandbox.path, environment);
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-pushed', '--json'];
    const settings = settingsText(['secrets']);
    const identityIgnore = `
[[ignore]]
check = "secrets/gitleaks-pushed"
rule = "${leaked}:identity.py:aws-access-token:1"
reason = "The exact historical token is an inert example."
`;
    await Bun.write(join(sandbox.path, 'gspot.toml'), settings + identityIgnore);
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
    for (const token of [AWS_KEY_ID, API_TOKEN]) expect(reviewed.stdout + reviewed.stderr).not.toContain(token);
    await Bun.write(
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
    gitOutput(sandbox.path, ['add', 'gspot.toml']);
    gitOutput(sandbox.path, ['commit', '-qm', 'docs: review other historical token']);
    const acceptedRevision = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const accepted = await spawnGspot(sandbox.path, command, environment, {
        stdin: `refs/heads/main ${acceptedRevision} refs/heads/main ${base}\n`,
    });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings).toStrictEqual([]);
});

test.each([...GITLEAKS_SCOPES])(
    'an ignore of one gitleaks fingerprint works at the %s and in a scratch copy without Git',
    async (_name, folder) => {
        await using sandbox = await testdir();
        const environment = { PATH: toolsPath() };
        const tables =
            folder === ''
                ? ''
                : `[[scope]]
path = "app"

configurations = ["secrets"]
`;
        const settings = settingsText(['secrets'], { tables });
        await createFileTree(sandbox.path, { 'gspot.toml': settings });
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await createFileTree(
            sandbox.path,
            Object.fromEntries(Object.entries(SECRET_FILES).map(([file, text]) => [folder + file, text])),
        );
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            settings +
                `
[[ignore]]
check = "secrets/gitleaks-files"
rule = "${folder}identity.py:aws-access-token:1"
paths = ["${folder}identity.py"]
reason = "This exact inert token is a reviewed example."
`,
        );
        using copied = await copyIntoScratch({
            root: sandbox.path,
            dependencies: [],
            paths: [
                'gspot.toml',
                '.gspot/config/gitleaks.toml',
                ...Object.keys(SECRET_FILES).map((file) => folder + file),
            ],
        });
        const command = ['check', '--only', 'secrets/gitleaks-files', '--json'];
        for (const root of [sandbox.path, copied.path]) {
            const checked = await spawnGspot(root, command, environment);
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
            for (const token of [AWS_KEY_ID, API_TOKEN]) expect(checked.stdout + checked.stderr).not.toContain(token);
        }
    },
);
