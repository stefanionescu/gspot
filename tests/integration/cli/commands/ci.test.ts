import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { git, gitOutput } from '#tests/harness/cli/git.ts';
import { gspot, runGspot } from '#tests/harness/cli/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { rmSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

function commitCiSource(root: string, text: string): string {
    gitOutput(root, ['add', '-A']);
    gitOutput(root, ['commit', '-qm', text]);
    return gitOutput(root, ['rev-parse', 'HEAD']);
}

/** Creates authored provider jobs and a changed object with a deliberate shell syntax error. */
async function prepareCiProject(
    root: string,
    provider: 'gitlab' | 'github',
): Promise<{
    base: string;
    generated: {
        gspot: { script: string[] };
        jobs: Record<string, { steps: { run?: string; uses?: string; if?: string; with?: Record<string, string> }[] }>;
    };
    pipeline: string;
    pipelinePath: string;
    workflowPath: string;
}> {
    gitOutput(root, ['init', '-q']);
    const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
    const pipeline =
        provider === 'gitlab'
            ? 'stages: [test]\napplication:\n  script: echo authored-job\n'
            : 'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo authored-job\n';
    const policy = `kits = []
[rules]
install = false
[ci]
provider = "${provider}"
[[check]]
name = "project/syntax"
stage = "commit"
paths = ["*.sh"]
command = ${JSON.stringify([process.execPath, '-e', 'for (const path of process.argv.slice(1)) { const result = Bun.spawnSync(["bash", "-n", path]); if (result.exitCode !== 0) { console.log(path + ": syntax error"); process.exitCode = 1; } }', '{files}'])}
[check.output]
format = "lines"
`;
    await createFileTree(root, {
        'gspot.toml': policy,
        [pipelinePath]: pipeline,
        'changed.sh': 'echo valid\n',
        'legacy.sh': 'if then\n',
    });
    const applied = await runGspot(root, ['apply']);
    if (applied.code !== 0) throw new Error(`CI fixture apply failed: ${applied.stdout}${applied.stderr}`);
    const base = commitCiSource(root, 'base');
    writeFileSync(join(root, 'changed.sh'), 'if then\n');
    commitCiSource(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(readFileSync(join(root, workflowPath), 'utf8')) as {
        gspot: { script: string[] };
        jobs: Record<string, { steps: { run?: string; uses?: string; if?: string; with?: Record<string, string> }[] }>;
    };
    return { base, generated, pipeline, pipelinePath, workflowPath };
}

/** A fake npm on the job's PATH: its global install of gspot writes a launcher of the source CLI, or fails on request. */
function createCiInstall(directory: string): { directory: string; refuse: () => void; allow: () => void } {
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
if (command !== 'install' || flag !== '--global' || !spec?.startsWith('@gspothq/cli@')) process.exit(2);
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
async function runCiJob(
    root: string,
    generated: {
        gspot: { script: string[] };
        jobs: Record<string, { steps: { run?: string; uses?: string; if?: string; with?: Record<string, string> }[] }>;
    },
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

// Whether the GitHub manual job alone runs the manual stage.
function runsManualStageAlone(generated: {
    gspot: { script: string[] };
    jobs: Record<string, { steps: { run?: string; uses?: string; if?: string; with?: Record<string, string> }[] }>;
}): boolean {
    const check = generated.jobs['check-ubuntu']!.steps;
    const manual = generated.jobs['manual-ubuntu']!.steps;
    return (
        manual.some((step) => step.run?.includes('--stage manual') === true) &&
        !check.some((step) => step.run?.includes('--stage manual') === true)
    );
}

test.each(['gitlab', 'github'] as const)(
    'generated jobs check changed objects and accept corrected source in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, generated } = await prepareCiProject(repository.path, provider);
        const install = createCiInstall(executables.path);
        const invalid = await runCiJob(repository.path, generated, install.directory, base, provider);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(invalid.stdout).toContain('project/syntax');
        expect(invalid.stdout).toContain('changed.sh');
        expect(invalid.stdout).not.toContain('legacy.sh');
        expect(provider === 'gitlab' || runsManualStageAlone(generated)).toBe(true);
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitCiSource(repository.path, 'correct syntax');
        const valid = await runCiJob(repository.path, generated, install.directory, base, provider);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        const firstPush = await runCiJob(repository.path, generated, install.directory, '0'.repeat(40), provider);
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout).toContain('legacy.sh');
    },
    120_000,
);

test.each(['gitlab', 'github'] as const)(
    'invalid comparisons and failed installs fail the job until correction in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, generated } = await prepareCiProject(repository.path, provider);
        const install = createCiInstall(executables.path);
        const initial = await runCiJob(repository.path, generated, install.directory, base, provider);
        expect(initial.code).toBe(1);
        const malformed = await runCiJob(repository.path, generated, install.directory, '$(touch injected)', provider);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('Invalid CI comparison object');
        expect(existsSync(join(repository.path, 'injected'))).toBe(false);
        const missing = await runCiJob(repository.path, generated, install.directory, 'f'.repeat(40), provider);
        expect(missing.code).not.toBe(0);
        install.refuse();
        const refused = await runCiJob(repository.path, generated, install.directory, base, provider);
        expect(refused.code).toBe(1);
        expect(refused.stderr).toContain('404 Not Found');
        install.allow();
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitCiSource(repository.path, 'correct syntax');
        const corrected = await runCiJob(repository.path, generated, install.directory, base, provider);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    120_000,
);

test.each(['gitlab', 'github'] as const)(
    'full-tree selection preserves authored jobs and rejects an invalid run setting in %s CI',
    async (provider) => {
        await using repository = await testdir();
        await using executables = await testdir();
        const { base, pipeline, pipelinePath, workflowPath } = await prepareCiProject(repository.path, provider);
        const install = createCiInstall(executables.path);
        const policyBefore = readFileSync(join(repository.path, 'gspot.toml'));
        const invalidSetting = await runGspot(repository.path, ['set', 'ci.run', 'unknown']);
        expect(invalidSetting.code).toBe(2);
        expect(readFileSync(join(repository.path, 'gspot.toml'))).toStrictEqual(policyBefore);
        for (const args of [['set', 'ci.run', 'all'], ['apply']]) {
            const changed = await runGspot(repository.path, args);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        }
        writeFileSync(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitCiSource(repository.path, 'check the full tree in CI');
        const full = Bun.YAML.parse(readFileSync(join(repository.path, workflowPath), 'utf8')) as {
            gspot: { script: string[] };
            jobs: Record<
                string,
                { steps: { run?: string; uses?: string; if?: string; with?: Record<string, string> }[] }
            >;
        };
        const all = await runCiJob(repository.path, full, install.directory, base, provider);
        expect(all.code, all.stdout + all.stderr).toBe(1);
        expect(all.stdout).toContain('legacy.sh');
        expect(readFileSync(join(repository.path, pipelinePath), 'utf8')).toBe(pipeline);
        expect(readFileSync(join(repository.path, 'changed.sh'), 'utf8')).toBe('echo corrected\n');
    },
    120_000,
);

// Each row names the provider init proposes and the note or file its plan must carry.
test.each([
    ['Jenkinsfile', 'pipeline { agent any }\n', 'git@github.com:example/project.git', 'none', 'CI retained'],
    [
        '.gitlab-ci.yml',
        'application:\n  script: echo app\n',
        'git@github.com:example/project.git',
        'gitlab',
        'include:',
    ],
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo app\n',
        'git@gitlab.com:example/project.git',
        'github',
        '.github/workflows/gspot.yml',
    ],
    ['README.md', '# Project\n', 'git@gitlab.com:example/project.git', 'gitlab', 'include:'],
    [
        '.gitlab-ci.yml',
        'lint:\n  script: npm run lint\n',
        'git@github.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  quality:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n',
        'git@gitlab.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
] as const)(
    'init reads %s before its remote and preserves existing CI jobs',
    async (path, content, remote, provider, note) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { [path]: content });
        expect(git(repository.path, ['init', '-q']).code).toBe(0);
        expect(git(repository.path, ['remote', 'add', 'origin', remote]).code).toBe(0);
        const result = await runGspot(repository.path, [
            'init',
            '--dry-run',
            '--json',
            '--yes',
            '--kits',
            'none',
            '--no-runner',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const plan = JSON.parse(result.stdout) as { policy: string; plan: { retained: unknown; write: unknown } };
        expect(/provider = "(\w+)"/u.exec(plan.policy)?.[1] ?? 'none').toBe(provider);
        expect(JSON.stringify(plan.plan)).toContain(note);
        expect(readFileSync(join(repository.path, path), 'utf8')).toBe(content);
        expect(await Bun.file(join(repository.path, 'gspot.toml')).exists()).toBe(false);
    },
);
