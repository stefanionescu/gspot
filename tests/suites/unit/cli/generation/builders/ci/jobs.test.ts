import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { CI_PINS } from '#cli/config/settings/tables.ts';
import type { Pipeline } from '#cli/types/generation.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildGithubWorkflow } from '#cli/generation/builders/ci.ts';
import { LINUX_PIPELINE } from '#tests/config/generation/builders.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/setup.ts';
import { CI_CHECK_COMMAND, GITHUB_EXPRESSION_MESSAGE } from '#cli/config/generation/builders.ts';

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
