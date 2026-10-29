import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { join, dirname, delimiter } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/bash.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { COMMAND_CHECK_HELP_LINE } from '#tests/config/messages.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { CLI_BIN, applyThenInstall } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { type CiDocument, type GithubWorkflow } from '#tests/types/ci.ts';
import { CI_CHECKS, GITHUB_WORKFLOW } from '#tests/config/integration/ci.ts';

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
        rules: { enabled: false },
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
    await applyThenInstall(root);
}

async function commitCiChanges(root: string, provider: 'gitlab' | 'github') {
    const base = commitAll(root, 'base');
    await writeFile(join(root, 'changed.sh'), BROKEN_IF_SCRIPT);
    commitAll(root, 'invalid change');
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

    const result = await runCommand(
        [
            'bash',
            '-e',
            '-c',
            `${command.replace('>> "$GITHUB_PATH"', '> "$GITHUB_PATH"')}\nPATH="$(paste -sd : - < "$GITHUB_PATH"):$PATH"\ngspot --version`,
        ],
        {
            cwd: sandbox.path,
            env: {
                GITHUB_PATH: join(sandbox.path, 'github-path'),
                MISE_CONFIG_DIR: join(sandbox.path, 'config'),
                MISE_DATA_DIR: join(sandbox.path, 'data'),
                MISE_STATE_DIR: join(sandbox.path, 'state'),
                MISE_CACHE_DIR: join(sandbox.path, 'cache'),
                MISE_CEILING_PATHS: dirname(sandbox.path),
            },
        },
    );
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
        const lines = invalid.stdout.split('\n');
        const start = lines.indexOf('project/syntax  failed  1 finding');
        expect(lines.slice(start, start + 4), invalid.stdout).toStrictEqual([
            'project/syntax  failed  1 finding',
            '  changed.sh: syntax error',
            COMMAND_CHECK_HELP_LINE,
            `  run again: gspot check --only project/syntax --changed ${base}`,
        ]);
        await writeFile(join(sandbox.path, 'changed.sh'), 'echo corrected\n');
        runGitStep(sandbox.path, ['add', 'changed.sh']);
        runGitStep(sandbox.path, ['commit', '-qm', 'correct syntax']);
        const valid = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        const firstPush = await runCiJob(sandbox.path, generated, executables.path, '0'.repeat(base.length));
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout.split('\n').filter((line) => line.includes('.sh:'))).toStrictEqual([
            '  legacy.sh: syntax error',
        ]);
    });

    test('a malformed or unknown base revision exits 2 without running it, and a failed install fails the job', async () => {
        await using sandbox = await testdir();
        await prepareCiProject(sandbox.path, provider);
        await using executables = await createGitSandbox({});
        const { base, generated } = await commitCiChanges(sandbox.path, provider);
        const failurePath = await fakeCiMise(executables.path);
        const malformed = await runCiJob(sandbox.path, generated, executables.path, '$(touch injected)');
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toBe(
            'Git merge-base failed for $(touch injected): fatal: Not a valid object name $(touch injected).\n',
        );
        expect(await isOnDisk(join(sandbox.path, 'injected'))).toBe(false);
        const missing = await runCiJob(sandbox.path, generated, executables.path, 'f'.repeat(base.length));
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(missing.stderr).toBe(
            `Git merge-base failed for ${'f'.repeat(base.length)}: fatal: Not a valid commit name ${'f'.repeat(base.length)}.\n`,
        );
        await writeFile(failurePath, '');
        const refused = await runCiJob(sandbox.path, generated, executables.path, base);
        expect(refused.code, refused.stdout + refused.stderr).toBe(1);
        expect(refused.stderr).toBe('npm error 404 Not Found - GET https://registry.npmjs.org/@gspothq/cli\n');
    });
});
