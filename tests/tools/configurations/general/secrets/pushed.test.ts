// Gitleaks and pinned TruffleHog scan pushed history for secrets removed by later commits.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { chmodSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { git, gitOutput } from '#tests/harness/git.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { NO_AGENT_RULES } from '#tests/config/harness/policy.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { testKeyId, secretSettings } from '#tests/config/harness/secrets.ts';
import { VERIFIER_TOKENS } from '#tests/config/tools/configurations/general/secrets-pushed.ts';
import type { SecretHistory, SecretVerifier } from '#tests/types/tools/configurations/general/secrets.ts';

/** Creates independent clean and leaked histories whose final trees contain no test files. */
async function prepareSecretHistory(root: string, files: Record<string, string>): Promise<SecretHistory> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['secrets'], { tables: NO_AGENT_RULES }),
    });
    gitOutput(root, ['init', '-q']);
    const applied = await spawnGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`Secret fixture apply failed: ${applied.stdout}${applied.stderr}`);
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

/** Routes native TruffleHog verification to a local provider. Writing native, malformed, or crashed to modeFile controls its launcher. */
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
        const native = Bun.which('trufflehog', { PATH: buildToolsPath(['trufflehog']) });
        if (native === null) throw new Error('The pinned TruffleHog executable is unavailable.');
        const config = join(directory, 'detectors.json');
        const modeFile = join(directory, 'mode');
        writeFileSync(modeFile, 'native');
        writeFileSync(
            config,
            JSON.stringify({
                detectors: [
                    {
                        name: 'GspotAcceptance',
                        keywords: ['gspot-acceptance-token-'],
                        regex: { token: '(gspot-acceptance-token-[a-z]+)' },
                        verify: [{ endpoint: verifier.url.toString(), unsafe: true }],
                    },
                ],
            }),
        );
        await createFileTree(directory, {
            trufflehog: `#!/usr/bin/env bun\nimport { readFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst mode = readFileSync(${JSON.stringify(modeFile)}, 'utf8');\nif (!args.includes('--version') && mode !== 'native') { console.log(${JSON.stringify(firstToken)}); console.error(${JSON.stringify(secondToken)}); process.exit(mode === 'malformed' ? 0 : 2); }\nconst child = Bun.spawn([${JSON.stringify(native)}, ...args, ...(args.includes('--version') ? [] : ['--config', ${JSON.stringify(config)}, '--include-detectors=CustomRegex'])], {stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'});\nprocess.exit(await child.exited);\n`,
        });
        // Windows finds an executable by its extension, so a command file runs the script there.
        writeFileSync(join(directory, 'trufflehog.cmd'), `@echo off\r\n"${process.execPath}" "%~dp0trufflehog" %*\r\n`);
        chmodSync(join(directory, 'trufflehog'), 0o755);
        return {
            firstToken,
            secondToken,
            requests,
            modeFile,
            async [Symbol.asyncDispose]() {
                await verifier.stop(true);
            },
        };
    } catch (error) {
        await verifier.stop(true);
        throw error;
    }
}

test(
    'pushed secret history includes removed secrets and excludes unrelated refs despite identical final trees',
    async () => {
        await using sandbox = await testdir();
        const { base, tree, good, leaked, removed } = await prepareSecretHistory(sandbox.path, {
            'settings.py': secretSettings,
        });
        expect(git(sandbox.path, ['rev-parse', 'HEAD^{tree}']).stdout.trim()).toBe(tree);
        const command = ['check', '--hook', 'pre-push', '--only', 'secrets/gitleaks-history', '--json'];
        const options = { env: { PATH: buildToolsPath(['gitleaks']) } };
        const rejected = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = JSON.parse(rejected.stdout) as PushReport;
        expect(report.revisions).toHaveLength(1);
        expect(report.revisions[0]?.commits).toContain(leaked);
        expect(report.revisions[0]?.report.checks).toMatchObject([
            { check: 'secrets/gitleaks-history', status: 'failed' },
        ]);
        expect(report.revisions[0]?.report.checks[0]?.findings).toContainEqual(
            containing({ rule: 'aws-access-token', file: 'settings.py', line: 1 }),
        );
        expect(rejected.stdout).not.toContain(testKeyId);
        await Bun.write(join(sandbox.path, 'settings.py'), secretSettings);
        const corrected = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
        const alreadyRemote = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/removed ${removed} refs/heads/removed ${leaked}\n`,
        });
        expect(alreadyRemote.code, alreadyRemote.stdout + alreadyRemote.stderr).toBe(0);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'verified-secret history scans every changed blob without exposing raw credentials',
    async () => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        await using verifier = await createSecretVerifier(launcher.path);
        const { firstToken, secondToken, requests, modeFile } = verifier;
        const { base, good, leaked, removed } = await prepareSecretHistory(sandbox.path, {
            'first.txt': firstToken,
            'second.txt': secondToken,
        });
        const command = ['check', '--hook', 'pre-push', '--only', 'secrets/trufflehog', '--json'];
        const options = {
            env: { PATH: `${launcher.path}${delimiter}${buildToolsPath(['trufflehog'])}` },
        };
        const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
        const rejected = await spawnGspot(sandbox.path, command, options.env, { stdin: input });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = JSON.parse(rejected.stdout) as PushReport;
        const findings = report.revisions[0]?.report.checks[0]?.findings ?? [];
        expect(
            findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['first.txt', 'second.txt']);
        expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([firstToken]) } });
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([secondToken]) } });
        for (const token of [firstToken, secondToken]) expect(rejected.stdout + rejected.stderr).not.toContain(token);
        writeFileSync(modeFile, 'native');
        requests.length = 0;
        const corrected = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
        expect(requests).toStrictEqual([]);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.each(['malformed', 'crashed'])(
    'verified-secret history redacts %s tool output and accepts corrected execution',
    async (failure) => {
        await using sandbox = await testdir();
        await using launcher = await testdir();
        await using verifier = await createSecretVerifier(launcher.path);
        const { firstToken, secondToken, requests, modeFile } = verifier;
        const { base, good, removed } = await prepareSecretHistory(sandbox.path, {
            'first.txt': firstToken,
            'second.txt': secondToken,
        });
        const command = ['check', '--hook', 'pre-push', '--only', 'secrets/trufflehog', '--json'];
        const options = {
            env: { PATH: `${launcher.path}${delimiter}${buildToolsPath(['trufflehog'])}` },
        };
        const input = `refs/heads/good ${good} refs/heads/good ${base}\nrefs/heads/removed ${removed} refs/heads/removed ${base}\n`;
        writeFileSync(modeFile, failure);
        const broken = await spawnGspot(sandbox.path, command, options.env, { stdin: input });
        expect(broken.code, broken.stdout + broken.stderr).toBe(2);
        expect((JSON.parse(broken.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('error');
        for (const token of [firstToken, secondToken]) expect(broken.stdout + broken.stderr).not.toContain(token);
        writeFileSync(modeFile, 'native');
        requests.length = 0;
        const corrected = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
        expect(requests).toStrictEqual([]);
        expect(git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim()).toBe(removed);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
