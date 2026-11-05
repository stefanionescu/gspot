import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import { expect, test } from 'bun:test';
import { parse } from 'yaml';

import { CI_CHECK_COMMAND, GITHUB_EXPRESSION_MESSAGE } from '#cli/config/generation.ts';
import { CI_NODE } from '#cli/config/repository/javascript.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Pipeline } from '#cli/types/generation.ts';
import { LINUX_PIPELINE, SETUP_ARGUMENTS, SETUP_CASES } from '#tests/config/generation/files.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { readCallRecords } from '#tests/setup/system/programs.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/setup.ts';

test('the GitHub workflow gives the GitHub token to the gspot install only', () => {
    const workflow = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    const steps = workflow.jobs['lint']!.steps;
    expect(
        steps.filter((step) => step.env?.['MISE_GITHUB_TOKEN'] !== undefined).map((step) => step.name),
    ).toStrictEqual(['Install gspot']);
});

test.each<Partial<Pipeline>>([{ setupCommand: ['echo', '${{ secrets.DEPLOY_KEY }}'] }])(
    'the GitHub workflow refuses a command that holds a GitHub expression',
    (fields) => {
        expect(() => buildGithubWorkflow({ ...LINUX_PIPELINE, ...fields })).toThrow(
            new GspotError('settings', GITHUB_EXPRESSION_MESSAGE),
        );
    },
);

test('two operating systems get one job each, and the Linux job uses the configured runner', () => {
    const workflow = parse(
        buildGithubWorkflow({
            ...LINUX_PIPELINE,
            operatingSystems: ['linux', 'macos'],
            linuxRunner: 'linux-large',
        }).content,
    ) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint-linux', 'lint-macos']);
    expect(workflow.jobs['lint-linux']?.['runs-on']).toBe('linux-large');
});

test('test checks move to a tests job that differs from the lint job only in its check command', () => {
    const { jobs } = parse(
        buildGithubWorkflow({ ...LINUX_PIPELINE, testChecks: ['jest/tests', 'pytest/tests'] }).content,
    ) as GithubWorkflow;
    expect(Object.keys(jobs)).toStrictEqual(['lint', 'tests']);
    expect(jobs['lint']!.steps.at(-1)?.run).toBe(`${CI_CHECK_COMMAND} --skip jest/tests,pytest/tests\n`);
    expect(jobs['tests']!.steps.at(-1)?.run).toBe(`${CI_CHECK_COMMAND} --only jest/tests,pytest/tests\n`);
    expect(jobs['tests']!.steps.slice(0, -1)).toStrictEqual(jobs['lint']!.steps.slice(0, -1));
});

test('without test checks, the lint job runs every check and no tests job exists', () => {
    const { jobs } = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    expect(Object.keys(jobs)).toStrictEqual(['lint']);
    expect(jobs['lint']!.steps.at(-1)?.run).toBe(`${CI_CHECK_COMMAND}\n`);
});

test('each operating system gets one pair of jobs', () => {
    const { jobs } = parse(
        buildGithubWorkflow({
            ...LINUX_PIPELINE,
            operatingSystems: ['linux', 'macos'],
            testChecks: ['vitest/tests'],
        }).content,
    ) as GithubWorkflow;
    expect(Object.keys(jobs)).toStrictEqual(['lint-linux', 'lint-macos', 'tests-linux', 'tests-macos']);
    expect(jobs['tests-macos']?.name).toBe('tests (macos)');
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
    expect(workflow.jobs['lint']?.steps.at(-1)?.run).toBe(`${CI_CHECK_COMMAND} --skip jest/tests\n`);
    expect(workflow.jobs['tests']?.steps.at(-1)?.run).toBe(`${CI_CHECK_COMMAND} --only jest/tests\n`);
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

test('the swift configuration defaults the CI jobs to Linux and macOS', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { tables: '[ci]\nenabled = true\n' }),
        'Package.swift': '// swift-tools-version: 6.0\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const workflow = parse(await readFile(join(sandbox.path, '.github/workflows/gspot.yml'), 'utf8')) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint-linux', 'lint-macos']);
});

test.each([...SETUP_CASES])(
    'the %s job keeps setup exit %i and literal arguments before gspot',
    async (provider, setupExit) => {
        const pipeline = LINUX_PIPELINE;
        await using sandbox = await createGitSandbox({ '.gspot/version': '1.2.3' });
        await using programs = await createGitSandbox({});
        runGitStep(sandbox.path, ['add', '.gspot/version']);
        const commands = join(programs.path, 'commands.log');
        const bin = await writeProgramCommand(programs.path, 'bin/mise', 'fakes/tool');
        await writeProgramCommand(programs.path, 'bin/gspot', 'fakes/tool', '--record', commands, '--');
        await writeProgramCommand(
            programs.path,
            'bin/project setup',
            'fakes/tool',
            '--record',
            commands,
            '--stdout',
            'setup out\n',
            '--stderr',
            'setup err\n',
            '--exit',
            String(setupExit),
            '--',
        );
        const setupPipeline = {
            ...pipeline,
            setupCommand: [join(bin, 'project setup'), ...SETUP_ARGUMENTS],
        };
        const script =
            provider === 'github'
                ? (parse(buildGithubWorkflow(setupPipeline).content) as GithubWorkflow).jobs['lint']!.steps.flatMap(
                      (step) => step.run ?? [],
                  )
                : (parse(buildGitlabWorkflow(setupPipeline).content) as GitlabPipeline).gspot.script;
        const result = await runCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: {
                PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
                GITHUB_PATH: join(programs.path, 'github-path'),
            },
        });
        expect(result.code, result.stdout + result.stderr).toBe(setupExit);
        expect(result.stdout).toBe('setup out\n');
        expect(result.stderr).toBe('setup err\n');
        const gspotCalls = setupExit === 0 ? [['install'], ['check', '--base', '']] : [];
        const calls = await readCallRecords(commands);
        expect(calls.map((call) => call.arguments)).toStrictEqual([[...SETUP_ARGUMENTS], ...gspotCalls]);
        expect(existsSync(join(sandbox.path, 'unexpected'))).toBe(false);
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
