import { parse } from 'yaml';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { CI_PINS } from '#cli/config/settings/tables.ts';
import type { Pipeline } from '#cli/types/generation.ts';
import { CI_NODE } from '#cli/config/tools/installers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readCallRecords, writeProgramCommand } from '#tests/setup/system/programs.ts';
import { MISE_EXEC, SETUP_CASES, LINUX_PIPELINE } from '#tests/config/generation/builders.ts';
import { CI_CHECK_COMMAND, GITHUB_EXPRESSION_MESSAGE } from '#cli/config/generation/builders.ts';
import type { CallRecord, ProcessOutput, GithubWorkflow, GitlabPipeline } from '#tests/types/setup.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/builders/ci.ts';

async function runPipelineScript(
    provider: 'github' | 'gitlab',
    options: { mise: string; env?: Record<string, string>; setupExit?: number },
): Promise<ProcessOutput & { calls: CallRecord[] }> {
    await using sandbox = await createGitSandbox({});
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

test.each<Partial<Pipeline>>([
    { setupCommand: ['echo', '${{ secrets.DEPLOY_KEY }}'] },
    { projectInstall: ['(cd ${{ github.token }} && npm ci)'] },
])('the GitHub workflow refuses a GitHub expression in %j', (commands) => {
    expect(() => buildGithubWorkflow({ ...LINUX_PIPELINE, ...commands })).toThrow(
        new GspotError('settings', GITHUB_EXPRESSION_MESSAGE),
    );
});

test('each operating system gets a lint job and a tests job, and only the Linux jobs use the configured runner', () => {
    const { jobs } = parse(
        buildGithubWorkflow({
            ...LINUX_PIPELINE,
            operatingSystems: ['linux', 'macos'],
            linuxRunner: 'linux-large',
            testChecks: ['vitest/tests'],
        }).content,
    ) as GithubWorkflow;
    const macosRunner = CI_PINS.githubRunners.macos.label;
    expect(Object.entries(jobs).map(([key, job]) => [key, job.name, job['runs-on']])).toStrictEqual([
        ['lint-linux', 'lint (linux)', 'linux-large'],
        ['lint-macos', 'lint (macos)', macosRunner],
        ['tests-linux', 'tests (linux)', 'linux-large'],
        ['tests-macos', 'tests (macos)', macosRunner],
    ]);
});

test('test checks move to a tests job that differs from the lint job only in its check command', () => {
    const { jobs } = parse(
        buildGithubWorkflow({ ...LINUX_PIPELINE, testChecks: ['jest/tests', 'pytest/tests'] }).content,
    ) as GithubWorkflow;
    expect(Object.keys(jobs)).toStrictEqual(['lint', 'tests']);
    expect(jobs['lint']!.steps.at(-1)?.run).toEndWith(` -- ${CI_CHECK_COMMAND} --skip jest/tests,pytest/tests\n`);
    expect(jobs['tests']!.steps.at(-1)?.run).toEndWith(` -- ${CI_CHECK_COMMAND} --only jest/tests,pytest/tests\n`);
    expect(jobs['tests']!.steps.slice(0, -1)).toStrictEqual(jobs['lint']!.steps.slice(0, -1));
});

test('a selected testing configuration gets a tests job on GitHub and one job on GitLab', async () => {
    const files = {
        'package.json': '{"private":true,"devDependencies":{"jest":"30.0.0"}}',
        'source.js': 'export const value = 1;\n',
    };
    await using github = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['javascript', 'jest'], { tables: '[ci]\nenabled = true\n' }),
    });
    const workflow = parse(
        buildGeneratedFiles(await openSession(github.path)).files.find(
            ({ path }) => path === '.github/workflows/gspot.yml',
        )!.content,
    ) as GithubWorkflow;
    expect(workflow.jobs['lint']?.steps.at(-1)?.run).toEndWith(` -- ${CI_CHECK_COMMAND} --skip jest/tests\n`);
    expect(workflow.jobs['tests']?.steps.at(-1)?.run).toEndWith(` -- ${CI_CHECK_COMMAND} --only jest/tests\n`);
    await using gitlab = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['javascript', 'jest'], {
            tables: '[ci]\nenabled = true\nprovider = "gitlab"\n',
        }),
    });
    const pipeline = parse(
        buildGeneratedFiles(await openSession(gitlab.path)).files.find(({ path }) => path === '.gitlab/ci/gspot.yml')!
            .content,
    ) as GitlabPipeline;
    expect(Object.keys(pipeline)).toStrictEqual(['gspot']);
    expect(pipeline.gspot.script.at(-1)).toEndWith(CI_CHECK_COMMAND);
});

test('a scope with the swift configuration defaults the CI jobs to Linux and macOS', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[ci]\nenabled = true\n',
            scopes: [{ path: 'ios', configurations: ['swift'] }],
        }),
        'ios/Package.swift': '// swift-tools-version: 6.0\n',
    });
    const workflow = parse(
        buildGeneratedFiles(await openSession(sandbox.path)).files.find(
            ({ path }) => path === '.github/workflows/gspot.yml',
        )!.content,
    ) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint-linux', 'lint-macos']);
});

/**
Run the script of the lint job with a fake mise and a fake gspot that records its calls. With a setup exit code, the
pipeline also runs a fake setup command that prints to both streams and exits with that code.
*/
const SETUP_ARGUMENTS = ['', 'two words', "a'b", 'line\nbreak'] as const;

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

test('without a setup command, CI installs the locked dependencies of each project and writes Next.js route types', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python'], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
        'package-lock.json': '{"lockfileVersion":3}',
        'pyproject.toml': '[project]\nname = "service"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
        'web/package.json': '{"private":true,"packageManager":"pnpm@10.30.0","dependencies":{"next":"16.0.0"}}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'web/next.config.ts': EMPTY_DEFAULT_SOURCE,
        'main.py': 'value = 1\n',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });

    const session = await openSession(sandbox.path);
    const uv = readConfigurations()
        .get('python')!
        .tools.find(({ name }) => name === 'uv')?.version;
    expect(listProjectInstallLines(session)).toStrictEqual([
        `mise exec ${CI_NODE} npm@11.10.1 -- npm ci`,
        `mise exec ${CI_NODE} uv@${String(uv)} -- uv sync --locked`,
        `(cd web && mise exec ${CI_NODE} pnpm@10.30.0 -- pnpm install --frozen-lockfile)`,
        '(cd web && npx --no -- next typegen)',
    ]);
});

test('a Next.js scope without a lockfile gets no setup line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'web/package.json': '{"private":true,"dependencies":{"next":"16.0.0"}}',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });
    expect(listProjectInstallLines(await openSession(sandbox.path))).toStrictEqual([]);
});

test('CI reads no local program version: npm runs bare, and an unpinned pnpm stays unpinned', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web' }],
        }),
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3}',
        'web/package.json': '{"private":true}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
    });
    const session = await openSession(sandbox.path);
    expect(listProjectInstallLines(session)).toStrictEqual(['npm ci', '(cd web && pnpm install --frozen-lockfile)']);
});

test('the GitHub workflow pins each action to a full commit and names its version in a comment', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[ci]\nenabled = true\nprovider = "github"\n' }),
    });
    const content = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
        ({ path }) => path === '.github/workflows/gspot.yml',
    )!.content;
    const workflow = parse(content) as GithubWorkflow;
    const actions = Object.values(workflow.jobs).flatMap(({ steps }) => steps.filter(({ uses }) => uses !== undefined));
    const lines = content.split('\n').filter((line) => /\buses:/u.test(line));
    expect(lines).toHaveLength(actions.length);
    for (const line of lines)
        expect(line).toMatch(/^\s+(?:- )?uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(?:\.\d+)*$/u);
});
