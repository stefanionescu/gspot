import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { CI_CHECKS, GITHUB_WORKFLOW } from '#tests/config/integration/infrastructure.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { LINE_BREAK } from '#tests/config/setup/sandboxes.ts';
import { CLI_BIN, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import type { CiDocument } from '#tests/types/integration.ts';
import type { GithubWorkflow, ProcessOutput } from '#tests/types/setup.ts';

async function prepareCiProject(root: string, provider: 'gitlab' | 'github') {
    runGitStep(root, ['init', '-q']);
    const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
    const pipeline =
        provider === 'gitlab'
            ? `stages: [test]
application:
  script: echo authored-job
`
            : GITHUB_WORKFLOW;
    const settings = stringify({
        configurations: [],
        rule_files: { enabled: false },
        ci: { enabled: true, provider },
        command_check: [
            {
                ...CI_CHECKS.syntax,
                command: buildProgramCommand('checks/bash', '{files}'),
            },
            { ...CI_CHECKS.audit, command: buildProgramCommand('fakes/tool') },
        ],
        ignore: CI_CHECKS.ignore,
    });
    await createFileTree(root, {
        [pipelinePath]: pipeline,
        'changed.sh': 'echo valid\n',
        'legacy.sh': BROKEN_IF_SCRIPT,
    });
    await writeFile(join(root, 'gspot.toml'), settings);
    await runGspotStep({ root, run: spawnGspot }, ['install']);
}

function commitPastHooks(root: string, message: string): string {
    runGitStep(root, ['add', '-A']);
    runGitStep(root, ['commit', '-qm', message, '--no-verify']);
    return runGitStep(root, ['rev-parse', 'HEAD']);
}

async function commitCiChanges(root: string, provider: 'gitlab' | 'github') {
    const base = commitPastHooks(root, 'base');
    await writeFile(join(root, 'changed.sh'), BROKEN_IF_SCRIPT);
    commitPastHooks(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(await readFile(join(root, workflowPath), 'utf8')) as CiDocument;
    return { base, generated };
}

async function fakeCiMise(folder: string) {
    const nativeMise = Bun.which('mise')!;
    const failure = join(folder, 'mise-fails');
    await writeProgramCommand(
        folder,
        'mise',
        'fakes/mise',
        '--native-mise',
        nativeMise,
        '--cli-bin',
        CLI_BIN,
        '--failure-marker',
        failure,
        '--',
    );
    await writeProgramCommand(folder, 'gspot', 'processes/cli');
    return failure;
}

async function runCiJob(
    root: string,
    generated: CiDocument,
    folder: string,
    comparison: string,
): Promise<ProcessOutput> {
    const script =
        'gspot' in generated
            ? generated.gspot.script
            : generated.jobs['lint']!.steps.flatMap((step) =>
                  step.run === undefined || step.if !== undefined ? [] : step.run,
              );
    return await runCommand(['bash', '-e', '-c', script.join('\n')], {
        cwd: root,
        env: {
            PATH: `${folder}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
            CI_COMMIT_BEFORE_SHA: comparison,
            CI_MERGE_REQUEST_DIFF_BASE_SHA: '',
            GSPOT_CI_BASE: comparison,
            RUNNER_TEMP: folder,
            GITHUB_PATH: join(folder, 'github-path'),
            NO_COLOR: '1',
        },
    });
}

test('the generated GitHub command installs gspot with empty mise state', async () => {
    await using sandbox = await testdir();
    await prepareCiProject(sandbox.path, 'github');
    const workflow = Bun.YAML.parse(
        await readFile(join(sandbox.path, '.github/workflows/gspot.yml'), 'utf8'),
    ) as GithubWorkflow;
    const command = workflow.jobs['lint']!.steps.find((step) => step.name === 'Install gspot')!.run!;
    const env = {
        GITHUB_PATH: join(sandbox.path, 'github-path'),
        MISE_CONFIG_DIR: join(sandbox.path, 'config'),
        MISE_DATA_DIR: join(sandbox.path, 'data'),
        MISE_STATE_DIR: join(sandbox.path, 'state'),
        MISE_CACHE_DIR: join(sandbox.path, 'cache'),
        MISE_CEILING_PATHS: dirname(sandbox.path),
    };

    const installed = await runCommand(['bash', '-e', '-c', command], { cwd: sandbox.path, env });
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const githubPath = await readFile(env.GITHUB_PATH, 'utf8');
    const added = githubPath.split(LINE_BREAK).filter((path) => path !== '');
    const result = await runCommand(['bash', '-e', '-c', 'gspot --version'], {
        cwd: sandbox.path,
        env: { ...env, PATH: [...added, readEnvironmentVariable('PATH') ?? ''].join(delimiter) },
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(cliPackage.version);
});

describe.each(['gitlab', 'github'] as const)('%s CI', (provider) => {
    test('the jobs check the changed files, pass after the fix, and check every file of a first push', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await createGitSandbox({});
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        await fakeCiMise(executables.path);
        const invalid = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(invalid.stdout.split('\n').filter((line) => line.includes('.sh:'))).toStrictEqual([
            '  changed.sh: syntax error',
        ]);
        await writeFile(join(sandbox.path, 'changed.sh'), 'echo corrected\n');
        commitPastHooks(sandbox.path, 'correct syntax');
        const valid = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        const firstPush = await runCiJob(sandbox.path, generated, executables.path, '0'.repeat(base.length));
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout.split('\n').filter((line) => line.includes('.sh:'))).toStrictEqual([
            '  legacy.sh: syntax error',
        ]);
    });

    test('a hand edit of a generated file outside .gspot fails the job after gspot install', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await createGitSandbox({});
        const attributes = join(sandbox.path, '.gitattributes');
        const generatedAttributes = await readFile(attributes, 'utf8');
        await writeFile(attributes, generatedAttributes.replace('linguist-generated', 'text'));
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        await fakeCiMise(executables.path);
        const drifted = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(drifted.code, drifted.stdout + drifted.stderr).toBe(1);
        expect(drifted.stdout).toContain('.gitattributes');
    });

    test('a malformed base revision exits 2 without running it, and a failed install fails the job', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await createGitSandbox({});
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        const failurePath = await fakeCiMise(executables.path);
        const malformed = await runCiJob(sandbox.path, generated, executables.path, '$(touch injected)');
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('$(touch injected)');
        expect(existsSync(join(sandbox.path, 'injected'))).toBe(false);
        await writeFile(failurePath, '');
        const refused = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(refused.code, refused.stdout + refused.stderr).toBe(1);
        expect(refused.stdout).not.toContain('project/syntax');
    });
});
