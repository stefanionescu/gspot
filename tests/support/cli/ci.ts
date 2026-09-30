import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import * as processes from '#cli/platform/spawn.ts';
import { gitOutput } from '#tests/support/cli/git.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { run, gspot } from '#tests/support/cli/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareCiProjectResult } from '#tests/types/results.ts';
import type { Generated } from '#tests/types/acceptance/source/cli.ts';
import { rmSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';

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
    commitCiSource(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(readFileSync(join(root, workflowPath), 'utf8')) as Generated;
    return { base, generated, pipeline, pipelinePath, workflowPath };
}

/** A fake npm on the job's PATH: its global install of gspot writes a launcher of the source CLI, or fails on request. */
export function createCiInstall(directory: string): { directory: string; refuse: () => void; allow: () => void } {
    const launcher = `#!/usr/bin/env bun
const child = Bun.spawnSync([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`;
    const failure = join(directory, 'npm-fails');
    writeFileSync(
        join(directory, 'npm'),
        `#!/usr/bin/env bun
import { existsSync, writeFileSync } from 'node:fs';
const [command, flag, spec] = process.argv.slice(2);
if (existsSync(${JSON.stringify(failure)})) {
    console.error('npm error 404 Not Found - GET https://registry.npmjs.org/gspot');
    process.exit(1);
}
if (command !== 'install' || flag !== '--global' || !spec?.startsWith('gspot@')) process.exit(2);
writeFileSync(${JSON.stringify(join(directory, 'gspot'))}, ${JSON.stringify(launcher)}, { mode: 0o755 });
`,
    );
    chmodSync(join(directory, 'npm'), 0o755);
    return {
        directory,
        refuse: () => {
            writeFileSync(failure, '');
        },
        allow: () => {
            rmSync(failure, { force: true });
        },
    };
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
    // An absolute executable puts its own folder first on PATH, and Ubuntu has a curl in /bin, so bash is named bare.
    return await processes.run(['bash', '-e', '-c', script.join('\n')], {
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
