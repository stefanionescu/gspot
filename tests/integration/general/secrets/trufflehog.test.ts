import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/setup/install.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { containingAll } from '#tests/setup/matchers.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import type { SecretHistory, SecretVerifier } from '#tests/types/secrets.ts';
import { VERIFIER_TOKENS, TRUFFLEHOG_DETECTORS } from '#tests/config/secrets.ts';

/** Creates independent clean and leaked histories whose final trees contain no test files. */
async function prepareSecretHistory(root: string, files: Record<string, string>): Promise<SecretHistory> {
    await createFileTree(root, {
        'gspot.toml': settingsText(['secrets']),
    });
    gitOutput(root, ['init', '-q']);
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Secret sandbox apply failed: ${applied.stdout}${applied.stderr}`);
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', 'chore: initialize']);
    const base = gitOutput(root, ['rev-parse', 'HEAD']);
    const tree = gitOutput(root, ['rev-parse', 'HEAD^{tree}']);
    const good = gitOutput(root, ['commit-tree', tree, '-p', base, '-m', 'docs: reviewed']);
    await createFileTree(root, files);
    gitOutput(root, ['add', ...Object.keys(files)]);
    gitOutput(root, ['commit', '-qm', 'feat: settings']);
    const leaked = gitOutput(root, ['rev-parse', 'HEAD']);
    gitOutput(root, ['rm', ...Object.keys(files)]);
    gitOutput(root, ['commit', '-qm', 'fix: remove settings']);
    const removed = gitOutput(root, ['rev-parse', 'HEAD']);
    return { base, tree, good, leaked, removed };
}

/** Routes native TruffleHog verification to a local provider. */
async function createSecretVerifier(directory: string): Promise<SecretVerifier> {
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
        const native = Bun.which('trufflehog', { PATH: toolsPath() });
        if (native === null) throw new Error('The pinned TruffleHog executable is unavailable.');
        const config = join(directory, 'detectors.json');
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
            directory,
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
    const mise = Bun.which('mise', { PATH: toolsPath() });
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
    const command = ['check', '--hook', 'pre-push', '--only', 'secrets/trufflehog', '--json'];
    const options = {
        env: { PATH: `${launcher.path}${delimiter}${toolsPath()}` },
    };
    const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
    const rejected = await spawnGspot(sandbox.path, command, options.env, { stdin: input });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const report = JSON.parse(rejected.stdout) as PushReport;
    const check = report.revisions[0]!.report.checks[0]!;
    expect(check.status).toBe('failed');
    for (const token of [firstToken, secondToken]) expect(rejected.stdout + rejected.stderr).not.toContain(token);
    const findings = check.findings;
    expect(findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'first.txt',
        'second.txt',
    ]);
    expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
    expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([firstToken]) } });
    expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([secondToken]) } });
    requests.length = 0;
    const corrected = await spawnGspot(sandbox.path, command, options.env, {
        stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
    expect(requests).toStrictEqual([]);
    expect(gitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(removed);
});
