// Gitleaks and pinned TruffleHog scan pushed history for secrets removed by later commits.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { fakeTool } from '#tests/harness/platforms.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import type { SecretHistory, SecretVerifier } from '#tests/types/tools/configurations/general/secrets.ts';

import {
    VERIFIER_TOKENS,
    SECRET_VERIFICATION_CASES,
} from '#tests/config/tools/configurations/general/secrets/pushed.ts';

/** Creates independent clean and leaked histories whose final trees contain no test files. */
async function prepareSecretHistory(root: string, files: Record<string, string>): Promise<SecretHistory> {
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['secrets']),
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
        await writeFile(modeFile, 'native');
        await writeFile(
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
        await fakeTool(
            directory,
            'trufflehog',
            `#!/usr/bin/env bun\nimport { readFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst mode = readFileSync(${JSON.stringify(modeFile)}, 'utf8');\nif (!args.includes('--version') && mode !== 'native') { console.log(${JSON.stringify(firstToken)}); console.error(${JSON.stringify(secondToken)}); process.exit(mode === 'malformed' ? 0 : 2); }\nconst child = Bun.spawn([${JSON.stringify(native)}, ...args, ...(args.includes('--version') ? [] : ['--config', ${JSON.stringify(config)}, '--include-detectors=CustomRegex'])], {stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'});\nprocess.exit(await child.exited);\n`,
        );
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

test.each(SECRET_VERIFICATION_CASES)('$name', async ({ mode, code, status }) => {
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
    await writeFile(modeFile, mode);
    const rejected = await spawnGspot(sandbox.path, command, options.env, { stdin: input });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(code);
    const report = JSON.parse(rejected.stdout) as PushReport;
    const check = report.revisions[0]!.report.checks[0]!;
    expect(check.status).toBe(status);
    for (const token of [firstToken, secondToken]) expect(rejected.stdout + rejected.stderr).not.toContain(token);
    if (mode === 'native') {
        const findings = check.findings;
        expect(
            findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['first.txt', 'second.txt']);
        expect(findings.every((finding) => finding.message.includes(leaked))).toBe(true);
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([firstToken]) } });
        expect(requests).toContainEqual({ GspotAcceptance: { token: containingAll([secondToken]) } });
        await writeFile(modeFile, 'native');
        requests.length = 0;
        const corrected = await spawnGspot(sandbox.path, command, options.env, {
            stdin: `refs/heads/good ${good} refs/heads/good ${base}\n`,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as PushReport).revisions[0]?.report.checks[0]?.status).toBe('passed');
        expect(requests).toStrictEqual([]);
    }
    expect(gitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(removed);
});
