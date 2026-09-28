import { createHash } from 'node:crypto';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { gitOutput } from '#tests/support/cli/git.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareCiProjectResult } from '#tests/types/results.ts';
import type { Generated } from '#tests/types/acceptance/source/cli.ts';
import { run, gspot, runProcess } from '#tests/support/cli/command.ts';

/** Commits authored CI inputs and returns the exact object checked by the generated job. */
export function commitCiSource(root: string, text: string): string {
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', text]);
    return gitOutput(root, ['rev-parse', 'HEAD']);
}

/** Creates authored provider jobs and a changed object with a deliberate shell syntax error. */
export async function prepareCiProject(root: string, provider: 'gitlab' | 'github'): Promise<PrepareCiProjectResult> {
    gitOutput(root, ['init', '-q']);
    const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
    const pipeline =
        provider === 'gitlab'
            ? 'stages: [test]\napplication:\n  script: echo authored-job\n'
            : 'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo authored-job\n';
    const policy = `version = 1
kits = []
[guides]
install = false
[ci]
provider = "${provider}"
[[check]]
name = "project/syntax"
stage = "commit"
paths = ["*.sh"]
command = ${JSON.stringify([process.execPath, '-e', 'for (const path of process.argv.slice(1)) { const result = Bun.spawnSync(["/bin/bash", "-n", path]); if (result.exitCode !== 0) { console.log(path + ": syntax error"); process.exitCode = 1; } }', '{files}'])}
[check.output]
format = "lines"
`;
    await createFileTree(root, {
        'gspot.toml': policy,
        [pipelinePath]: pipeline,
        'changed.sh': 'echo valid\n',
        'legacy.sh': 'if then\n',
    });
    const applied = await run(root, ['apply']);
    if (applied.code !== 0) throw new Error(`CI fixture apply failed: ${applied.stdout}${applied.stderr}`);
    const base = commitCiSource(root, 'base');
    writeFileSync(join(root, 'changed.sh'), 'if then\n');
    const target = commitCiSource(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(readFileSync(join(root, workflowPath), 'utf8')) as Generated;
    return { base, target, generated, pipeline, pipelinePath, workflowPath };
}

/** Serves a checksum-controlled CLI download through the job's actual curl command. */
export async function createCiDownload(
    directory: string,
): Promise<{ directory: string; corrupt: boolean; [Symbol.asyncDispose](): Promise<void> }> {
    const binary = `#!/usr/bin/env bun
const child = Bun.spawnSync([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`;
    const digest = createHash('sha256').update(binary).digest('hex');
    let corrupt = false;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            const name = new URL(request.url).pathname.split('/').at(-1)!;
            return new Response(
                name === 'checksums.txt'
                    ? ['gspot-darwin-arm64', 'gspot-darwin-x64', 'gspot-linux-arm64', 'gspot-linux-x64']
                          .map((asset) => `${corrupt ? '0'.repeat(64) : digest}  ${asset}\n`)
                          .join('')
                    : binary,
            );
        },
    });
    try {
        const curl = Bun.which('curl');
        if (curl === null) throw new Error('Curl is required for the generated CI download fixture.');
        writeFileSync(
            join(directory, 'curl'),
            `#!/usr/bin/env bun
    const args = process.argv.slice(2).map(value => value.startsWith('https://github.com/stefanionescu/gspot/releases/download/') ? ${JSON.stringify(`http://127.0.0.1:${String(server.port)}`)} + new URL(value).pathname : value);
    process.exit(Bun.spawnSync([${JSON.stringify(curl)}, ...args], {stdin:'inherit',stdout:'inherit',stderr:'inherit'}).exitCode);
    `,
        );
        chmodSync(join(directory, 'curl'), 0o755);
        return {
            directory,
            get corrupt() {
                return corrupt;
            },
            set corrupt(value: boolean) {
                corrupt = value;
            },
            async [Symbol.asyncDispose]() {
                await server.stop(true);
            },
        };
    } catch (error) {
        await server.stop(true);
        throw error;
    }
}

/** Executes the generated provider script with its documented comparison and artifact environment. */
export async function runCiJob(
    root: string,
    generated: Generated,
    directory: string,
    comparison: string,
    provider: 'gitlab' | 'github',
): Promise<SpawnOutcome> {
    const script =
        provider === 'gitlab'
            ? generated.gspot.script
            : generated.jobs['check-ubuntu']!.steps.flatMap((step) => (step.run === undefined ? [] : [step.run]));
    return await runProcess(['/bin/bash', '-e', '-c', script.join('\n')], {
        cwd: root,
        env: {
            PATH: `${directory}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            CI_COMMIT_BEFORE_SHA: comparison,
            CI_MERGE_REQUEST_DIFF_BASE_SHA: '',
            GSPOT_CI_BASE: comparison,
            RUNNER_TEMP: directory,
            GITHUB_PATH: join(directory, 'github-path'),
            NO_COLOR: '1',
        },
        timeoutMs: 30_000,
    });
}
