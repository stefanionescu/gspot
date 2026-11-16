import { parse } from 'yaml';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Pipeline } from '#cli/types/generation.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readCallRecords, writeProgramCommand } from '#tests/setup/system/programs.ts';
import { buildGithubWorkflow, buildGitlabWorkflow } from '#cli/generation/builders/ci.ts';
import { MISE_EXEC, SETUP_CASES, LINUX_PIPELINE } from '#tests/config/generation/builders.ts';
import type { CallRecord, ProcessOutput, GithubWorkflow, GitlabPipeline } from '#tests/types/setup.ts';

const SETUP_ARGUMENTS = ['', 'two words', "a'b", 'line\nbreak'] as const;

/**
Run the script of the lint job with a fake mise and a fake gspot that records its calls. With a setup exit code, the
pipeline also runs a fake setup command that prints to both streams and exits with that code.
*/
async function runPipelineScript(
    provider: 'github' | 'gitlab',
    options: { mise: string; env?: Record<string, string>; setupExit?: number; untracked?: string },
): Promise<ProcessOutput & { calls: CallRecord[] }> {
    await using sandbox = await createGitSandbox({});
    if (options.untracked !== undefined) {
        await mkdir(join(sandbox.path, options.untracked, '..'), { recursive: true });
        await writeFile(join(sandbox.path, options.untracked), 'cached\n');
    }
    await using programs = await createGitSandbox({});
    const commands = join(programs.path, 'commands.log');
    const bin = join(programs.path, 'bin');
    await mkdir(bin);
    await writeFile(join(bin, 'mise'), `#!/bin/bash\n${options.mise}`, { mode: 0o755 });
    const recording = ['--record', commands, '--environment', 'MISE_LOADED', '--'];
    await writeProgramCommand(programs.path, 'bin/gspot', 'fakes/tool', ...recording);
    let pipeline: Pipeline = LINUX_PIPELINE;
    if (options.setupExit !== undefined) {
        const output = ['--stdout', 'setup out\n', '--stderr', 'setup err\n', '--exit', String(options.setupExit)];
        await writeProgramCommand(
            programs.path,
            'bin/project setup',
            'fakes/tool',
            '--record',
            commands,
            ...output,
            '--',
        );
        pipeline = { ...LINUX_PIPELINE, setupCommand: [join(bin, 'project setup'), ...SETUP_ARGUMENTS] };
    }
    const script =
        provider === 'github'
            ? (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps.flatMap(
                  (step) => step.run ?? [],
              )
            : (parse(buildGitlabWorkflow(pipeline).content) as GitlabPipeline).gspot.script;
    const result = await runCommand(['bash', '-e', '-c', script.join('\n')], {
        cwd: sandbox.path,
        env: {
            PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
            GITHUB_PATH: join(programs.path, 'github-path'),
            ...options.env,
        },
    });
    return { ...result, calls: existsSync(commands) ? await readCallRecords(commands) : [] };
}

test.each([...SETUP_CASES])(
    'the %s job keeps setup exit %i and literal arguments before gspot',
    async (provider, setupExit) => {
        const result = await runPipelineScript(provider, { mise: MISE_EXEC, setupExit });
        expect(result.code, result.stdout + result.stderr).toBe(setupExit);
        expect(result.stdout).toBe('setup out\n');
        expect(result.stderr).toBe('setup err\n');
        const gspotCalls = setupExit === 0 ? [['install'], ['check', '--base', '']] : [];
        expect(result.calls.map((call) => call.arguments)).toStrictEqual([[...SETUP_ARGUMENTS], ...gspotCalls]);
        const underMise = result.calls.filter((call) => call.environment['MISE_LOADED'] === '1');
        expect(underMise.map((call) => call.arguments[0])).toStrictEqual(setupExit === 0 ? ['check'] : []);
    },
);

test('the GitLab job compares with the merge request base, or else with the commit before the push', async () => {
    const pushed = await runPipelineScript('gitlab', {
        mise: MISE_EXEC,
        env: { CI_MERGE_REQUEST_DIFF_BASE_SHA: '', CI_COMMIT_BEFORE_SHA: 'before' },
    });
    expect(pushed.code).toBe(0);
    expect(pushed.calls.map((call) => call.arguments)).toStrictEqual([['install'], ['check', '--base', 'before']]);
    const merged = await runPipelineScript('gitlab', {
        mise: MISE_EXEC,
        env: { CI_MERGE_REQUEST_DIFF_BASE_SHA: 'target', CI_COMMIT_BEFORE_SHA: 'before' },
    });
    expect(merged.code).toBe(0);
    expect(merged.calls.map((call) => call.arguments)).toStrictEqual([['install'], ['check', '--base', 'target']]);
});

test('the GitLab job keeps its untracked cache folder out of the install check', async () => {
    const result = await runPipelineScript('gitlab', {
        mise: MISE_EXEC,
        env: { CI_MERGE_REQUEST_DIFF_BASE_SHA: '', CI_COMMIT_BEFORE_SHA: '' },
        untracked: '.cache/mise/data/tool',
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
});

test.each(['github', 'gitlab'] as const)(
    'a failed install of gspot stops the %s job before gspot runs',
    async (provider) => {
        const failed = await runPipelineScript(provider, {
            mise: `[ "$1" = install ] && exit 7\n${MISE_EXEC}`,
            env: { CI_MERGE_REQUEST_DIFF_BASE_SHA: '', CI_COMMIT_BEFORE_SHA: '' },
        });
        expect(failed).toMatchObject({ code: 7, calls: [] });
    },
);
