import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { chmod, readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { quoteArgument } from '#cli/system/text.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { type Pipeline } from '#cli/types/generation/ci.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { type GithubWorkflow, type GitlabPipeline } from '#tests/types/ci.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';

import {
    CI_PINS,
    CI_NODE,
    CI_CACHE_FILES,
    CI_CACHE_PREFIX,
    GITHUB_PUSH_CONDITION,
    GITHUB_SLOW_CONDITION,
} from '#cli/config/generation/ci.ts';
import {
    LINT_STEPS,
    SETUP_CASES,
    SETUP_SCRIPT,
    LINUX_PIPELINE,
    SETUP_ARGUMENTS,
    FAKE_MISE_SCRIPT,
    FAKE_GSPOT_SCRIPT,
} from '#tests/config/generation/ci.ts';

async function buildPipeline(resources: AsyncDisposableStack): Promise<Pipeline> {
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': buildSandboxSettings(['docs'], {
                tables: stringify({
                    command_check: [
                        { id: 'project/audit', paths: ['**/*'], stage: 'manual', command: ['echo', 'sample'] },
                    ],
                }),
            }),
            'README.md': '# Example\n',
            'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
        }),
    );
    const session = await openSession(sandbox.path);
    const pipeline: Pipeline = {
        ...LINUX_PIPELINE,
        operatingSystems: [...LINUX_PIPELINE.operatingSystems],
        projectInstall: [...LINUX_PIPELINE.projectInstall],
        lockfiles: [...LINUX_PIPELINE.lockfiles],
        manualChecks: session.configuredChecks.filter(({ check }) =>
            ['docs/lychee-external', 'project/audit'].includes(check.id),
        ),
        manualTools: session.configurations.get('docs')!.tools.filter((tool) => tool.name === 'lychee'),
    };
    return pipeline;
}

test('the GitHub workflow has one lint job, which ends with the slow checks only when there are some', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const workflow = parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint']);
    expect(workflow.jobs['lint']!.steps.map((step) => step.name)).toStrictEqual([...LINT_STEPS]);
    const none = parse(buildGithubWorkflow({ ...pipeline, manualChecks: [] }).content) as GithubWorkflow;
    expect(none.jobs['lint']!.steps.map((step) => step.name)).toStrictEqual(LINT_STEPS.slice(0, -1));
});

test('the Slow checks step names every slow check in one comma list', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);
    expect(pipeline.manualChecks.map(({ check }) => check.id)).toStrictEqual(['docs/lychee-external', 'project/audit']);
    const cli = `npm:@gspothq/cli@${pipeline.version}`;
    const command = `mise exec ${quoteArgument(CI_NODE)} ${quoteArgument(cli)} -- gspot`;
    const expected = `${command} check --only ${quoteArgument('docs/lychee-external,project/audit')}`;
    const steps = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps;
    expect(steps.find((step) => step.name === 'Slow checks')?.run).toBe(
        `(cd ${DOT_GSPOT} && mise install lychee)\n${expected}\n`,
    );
    expect(steps.find((step) => step.name === 'Lint')?.run).toBe(`${command} check --changed "\${GSPOT_CI_BASE}"\n`);
    expect(buildGitlabWorkflow(pipeline).content).toContain(expected);
});

test('pushes run the job on the default branch only, and the slow checks only on those pushes', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const job = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!;
    expect(job.if).toBe(GITHUB_PUSH_CONDITION);
    expect(job.steps.filter((step) => step.if === GITHUB_SLOW_CONDITION).map((step) => step.name)).toStrictEqual([
        'Slow checks',
    ]);
});

test('the cache key covers the gspot version, the tool files, and the project lockfiles, and the cache is saved before the checks', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const steps = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps;
    const restore = steps.find((step) => step.name === 'Restore caches')!;
    const hashed = [...CI_CACHE_FILES, ...pipeline.lockfiles].map((path) => `'${path}'`).join(', ');
    expect(restore.with?.['key']).toBe(`${CI_CACHE_PREFIX}${pipeline.version}-\${{ hashFiles(${hashed}) }}`);
    expect(restore.with?.['restore-keys']).toBe(CI_CACHE_PREFIX);
    const save = steps.find((step) => step.name === 'Save caches')!;
    expect(save).toMatchObject({
        if: `steps.${restore.id ?? ''}.outputs.cache-hit != 'true'`,
        with: { key: `\${{ steps.${restore.id ?? ''}.outputs.cache-primary-key }}`, path: restore.with?.['path'] },
    });
});

test('only the steps that install tools receive the GitHub token for mise', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const workflow = parse(
        buildGithubWorkflow({
            ...pipeline,
            manualChecks: pipeline.manualChecks.filter(({ check }) => check.id === 'docs/lychee-external'),
        }).content,
    ) as GithubWorkflow;
    const tokenSteps = Object.entries(workflow.jobs).flatMap(([job, { steps }]) =>
        steps
            .filter((step) => step.env?.['MISE_GITHUB_TOKEN'] !== undefined)
            .map((step) => `${job}: ${step.name ?? ''}`),
    );
    expect(tokenSteps).toStrictEqual(['lint: Install gspot tools', 'lint: Slow checks']);
});

test('a Swift scope adds a macOS job, each job names its system, and the Linux job uses the chosen runner', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const workflow = parse(
        buildGithubWorkflow({ ...pipeline, hasSwift: true, linuxRunner: 'linux-large' }).content,
    ) as GithubWorkflow;
    expect(
        Object.entries(workflow.jobs).map(([id, job]) => ({ id, name: job.name, runner: job['runs-on'] })),
    ).toStrictEqual([
        { id: 'lint-linux', name: 'lint (linux)', runner: 'linux-large' },
        { id: 'lint-macos', name: 'lint (macos)', runner: CI_PINS.githubRunners.macos.label },
    ]);
});

test.each([...SETUP_CASES])(
    'the %s job keeps setup exit %s and literal arguments before gspot',
    async (provider, setupExit) => {
        await using resources = new AsyncDisposableStack();
        const selectedPipeline = await buildPipeline(resources);

        await using sandbox = await testdir({
            'bin/mise': FAKE_MISE_SCRIPT,
            'bin/gspot': FAKE_GSPOT_SCRIPT,
            'bin/project setup': SETUP_SCRIPT,
        });

        for (const name of ['mise', 'gspot', 'project setup']) await chmod(join(sandbox.path, 'bin', name), 0o755);
        const commands = join(sandbox.path, 'commands.log');
        const argumentsPath = join(sandbox.path, 'arguments.log');
        const pipeline = {
            ...selectedPipeline,
            manualChecks: [],
            manualTools: [],
            setupCommand: [join(sandbox.path, 'bin', 'project setup'), ...SETUP_ARGUMENTS],
        };
        const script =
            provider === 'github'
                ? (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps.flatMap(
                      (step) => (step.run === undefined ? [] : [step.run]),
                  )
                : (parse(buildGitlabWorkflow(pipeline).content) as GitlabPipeline).gspot.script;
        const result = await runCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
                GSPOT_COMMAND_LOG: commands,
                GSPOT_SETUP_ARGUMENTS: argumentsPath,
                GSPOT_SETUP_EXIT: String(setupExit),
            },
        });
        expect(result.code, result.stdout + result.stderr).toBe(setupExit);
        expect(result.stdout).toBe('setup out\n');
        expect(result.stderr).toBe('setup err\n');
        expect(await readFile(commands, 'utf8')).toBe(
            setupExit === 0 ? 'setup\ninstall\ncheck --changed \n' : 'setup\n',
        );
        expect(await readFile(argumentsPath, 'utf8')).toBe(`${SETUP_ARGUMENTS.join('\n')}\n`);
        expect(await isOnDisk(join(sandbox.path, 'unexpected'))).toBe(false);
    },
);

test('without a setup command, CI installs the locked dependencies of each project and writes Next.js route types', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'python'], {
            tables: '[ci]\nenabled = true\nprovider = "github"\n',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
        'package-lock.json': '{"lockfileVersion":3}',
        'pyproject.toml': '[project]\nname = "service"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
        'web/package.json': '{"private":true,"dependencies":{"next":"16.0.0"}}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'web/next.config.ts': 'export default {};\n',
        'main.py': 'value = 1\n',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });

    const session = await openSession(sandbox.path);
    const uv = session.configurations.get('python')!.tools.find(({ name }) => name === 'uv')?.version;
    expect(listProjectInstallLines(session)).toStrictEqual([
        'npm ci',
        `mise exec uv@${String(uv)} -- uv sync --locked`,
        '(cd web && pnpm install --frozen-lockfile)',
        '(cd web && npx --no -- next typegen)',
    ]);
});
