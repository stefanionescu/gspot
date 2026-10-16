import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fakeTool } from '#tests/setup/fakes.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { matchItems } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { SecretHistory, SecretVerifier } from '#tests/types/secrets.ts';
import { VERIFIER_TOKENS, TRUFFLEHOG_DETECTORS } from '#tests/data/checks/secrets.ts';

/** Creates independent clean and leaked histories whose final trees contain no test files. */
async function prepareSecretHistory(root: string, files: Record<string, string>): Promise<SecretHistory> {
    await createFileTree(root, {
        'gspot.toml': buildSettingsText(['secrets']),
    });
    readGitOutput(root, ['init', '-q']);
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Secret sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    readGitOutput(root, ['add', '-A']);
    readGitOutput(root, ['commit', '-qm', 'chore: initialize']);
    const base = readGitOutput(root, ['rev-parse', 'HEAD']);
    const tree = readGitOutput(root, ['rev-parse', 'HEAD^{tree}']);
    const good = readGitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']);
    await createFileTree(root, files);
    readGitOutput(root, ['add', ...Object.keys(files)]);
    readGitOutput(root, ['commit', '-qm', 'feat: settings']);
    const leaked = readGitOutput(root, ['rev-parse', 'HEAD']);
    readGitOutput(root, ['rm', ...Object.keys(files)]);
    readGitOutput(root, ['commit', '-qm', 'fix: remove settings']);
    const removed = readGitOutput(root, ['rev-parse', 'HEAD']);
    return { base, tree, good, leaked, removed };
}

/** Routes native TruffleHog verification to a local provider. */
async function createSecretVerifier(folder: string): Promise<SecretVerifier> {
    const { first: firstToken, second: secondToken } = VERIFIER_TOKENS;
    const requests: unknown[] = [];
    const verifier = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        async fetch(request) {
            requests.push(await request.json());
            return new Response('{}', { status: 200 });
        },
    });
    try {
        const native = Bun.which('trufflehog', { PATH: buildSandboxPath() });
        if (native === null) throw new Error('The pinned TruffleHog executable is unavailable.');
        const config = join(folder, 'detectors.json');
        await writeFile(
            config,
            JSON.stringify({
                detectors: TRUFFLEHOG_DETECTORS.detectors.map((detector) => ({
                    ...detector,
                    verify: [{ endpoint: verifier.url.toString(), unsafe: true }],
                })),
            }),
        );
        await fakeTool(
            folder,
            'trufflehog',
            `const args = process.argv.slice(2);
const child = Bun.spawn([${JSON.stringify(native)}, ...args, ...(args.includes('--version') ? [] : ['--config', ${JSON.stringify(config)}, '--include-detectors=CustomRegex'])], {stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'});
process.exit(await child.exited);
`,
        );
        return {
            firstToken,
            secondToken,
            requests,
            async [Symbol.asyncDispose]() {
                await verifier.stop(true);
            },
        };
    } catch (error) {
        await verifier.stop(true);
        throw error;
    }
}

test('TruffleHog verifies the secrets of every pushed commit and never prints them', async () => {
    await using sandbox = await testdir();
    await using launcher = await testdir();
    await using verifier = await createSecretVerifier(launcher.path);
    const mise = Bun.which('mise', { PATH: buildSandboxPath() });
    if (mise === null) throw new Error('The native mise executable is unavailable.');
    await fakeTool(
        launcher.path,
        'mise',
        `const args = process.argv.slice(2);
const child = Bun.spawn([${JSON.stringify(mise)}, ...args], {stdout: 'pipe', stderr: 'inherit'});
const stdout = await new Response(child.stdout).text();
const code = await child.exited;
if (code === 0 && args[0] === 'bin-paths') process.stdout.write(${JSON.stringify(launcher.path + '\n')});
process.stdout.write(stdout);
process.exit(code);
`,
    );
    const { firstToken, secondToken, requests } = verifier;
    const { base, good, leaked, removed } = await prepareSecretHistory(sandbox.path, {
        'first.txt': firstToken,
        'second.txt': secondToken,
    });
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/trufflehog-pushed', '--json'];
    const options = {
        env: { PATH: `${launcher.path}${delimiter}${buildSandboxPath()}` },
    };
    const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
    const rejected = await spawnGspot(sandbox.path, command, options.env, { stdin: input });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const report = JSON.parse(rejected.stdout) as PushReport;
    expect(report.revisions.map(({ hash, report }) => ({ hash, status: report.checks[0]?.status }))).toStrictEqual([
        { hash: good, status: 'passed' },
        { hash: removed, status: 'failed' },
    ]);
    const check = report.revisions[1]!.report.checks[0]!;
    expect(check.status).toBe('failed');
    for (const token of [firstToken, secondToken]) expect(rejected.stdout + rejected.stderr).not.toContain(token);
    const findings = check.findings;
    expect(findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'first.txt',
        'second.txt',
    ]);
    expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
    expect(requests).toContainEqual({ GspotAcceptance: { token: matchItems([firstToken]) } });
    expect(requests).toContainEqual({ GspotAcceptance: { token: matchItems([secondToken]) } });
    requests.length = 0;
    const corrected = await spawnGspot(sandbox.path, command, options.env, {
        stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
    expect(requests).toStrictEqual([]);
    expect(readGitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(removed);
});
