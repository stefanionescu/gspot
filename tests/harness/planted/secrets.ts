import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { chmodSync, writeFileSync } from 'node:fs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

// A planted credential for the secrets tests, built from halves so no scanner of this repository reads a key here.
export const PLANTED_KEY_ID = ['AKIA', 'IOSFODNN7', 'EXAMPLA'].join('');

/** A settings file that holds the planted credential. */
export const PLANTED_SETTINGS = `aws_access_key_id = "${PLANTED_KEY_ID}"\n`;

/** Generates staged secret checks in a clean repository using its selected native tools. */
export async function prepareStagedSecrets(root: string): Promise<{ PATH: string }> {
    await createFileTree(root, { 'scripts/a.sh': script });
    commitAll(root);
    const environment = { PATH: toolsPath(['gitleaks']) };
    await installAtLevel(root, initArgs(['secrets']), environment);
    return environment;
}

/** Creates independent clean and leaked histories whose final trees contain no planted files. */
export async function prepareSecretHistory(
    root: string,
    files: Record<string, string>,
): Promise<{ base: string; tree: string; good: string; leaked: string; removed: string }> {
    await createFileTree(root, {
        'gspot.toml': policyOf(['secrets'], '[guides]\ninstall = false\n'),
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

/** Routes pinned TruffleHog custom-detector verification to a local provider and simulates process failures. */
export async function createSecretVerifier(directory: string): Promise<{
    firstToken: string;
    secondToken: string;
    requests: unknown[];
    mode: string;
    [Symbol.asyncDispose](): Promise<void>;
}> {
    const firstToken = ['gspot-acceptance-', 'token-first'].join('');
    const secondToken = ['gspot-acceptance-', 'token-second'].join('');
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
        const native = Bun.which('trufflehog', { PATH: toolsPath(['trufflehog']) });
        if (native === null) throw new Error('The pinned TruffleHog executable is unavailable.');
        const config = join(directory, 'detectors.json');
        const mode = join(directory, 'mode');
        writeFileSync(mode, 'native');
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
            trufflehog: `#!/usr/bin/env bun\nimport { readFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst mode = readFileSync(${JSON.stringify(mode)}, 'utf8');\nif (!args.includes('--version') && mode !== 'native') { console.log(${JSON.stringify(firstToken)}); console.error(${JSON.stringify(secondToken)}); process.exit(mode === 'malformed' ? 0 : 2); }\nconst child = Bun.spawn([${JSON.stringify(native)}, ...args, ...(args.includes('--version') ? [] : ['--config', ${JSON.stringify(config)}, '--include-detectors=CustomRegex'])], {stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'});\nprocess.exit(await child.exited);\n`,
        });
        chmodSync(join(directory, 'trufflehog'), 0o755);
        return {
            firstToken,
            secondToken,
            requests,
            mode,
            async [Symbol.asyncDispose]() {
                await verifier.stop(true);
            },
        };
    } catch (error) {
        await verifier.stop(true);
        throw error;
    }
}
