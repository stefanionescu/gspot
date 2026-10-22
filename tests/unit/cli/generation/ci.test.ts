import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { chmod, readFile } from 'node:fs/promises';
import { quoteArgument } from '#cli/system/text.ts';
import { CI_NODE } from '#cli/config/generation/ci.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { type Pipeline } from '#cli/types/generation/ci.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { type GithubWorkflow, type GitlabPipeline } from '#tests/types/ci.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';

import {
    SETUP_CASES,
    SETUP_SCRIPT,
    LINUX_PIPELINE,
    SETUP_ARGUMENTS,
    FAKE_MISE_SCRIPT,
    FAKE_GSPOT_SCRIPT,
} from '#tests/data/generation/ci.ts';

/** Build the CI pipeline in a new sandbox that lives until the test ends. */
async function buildPipeline(resources: AsyncDisposableStack): Promise<Pipeline> {
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': buildSandboxSettings(['docs'], {
                tables: '[[command_check]]\nid = "project/audit"\npaths = ["**/*"]\nstage = "manual"\ncommand = ["echo", "sample"]\n',
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
        manualChecks: session.configuredChecks.filter(({ check }) =>
            ['docs/lychee-external', 'project/audit'].includes(check.id),
        ),
        manualTools: session.configurations.get('docs')!.tools.filter((tool) => tool.name === 'lychee'),
    };
    return pipeline;
}

test('the GitHub workflow has a check job and a manual job per operating system, and no manual job without manual checks', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const file = buildGithubWorkflow({
        ...pipeline,
        manualChecks: pipeline.manualChecks.filter(({ check }) => check.id === 'docs/lychee-external'),
    });
    const workflow = parse(file.content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-linux', 'manual-linux']);
    const none = parse(buildGithubWorkflow({ ...pipeline, manualChecks: [] }).content) as GithubWorkflow;
    expect(Object.keys(none.jobs)).toStrictEqual(['check-linux']);
});

test('the manual jobs name every manual check in one comma list', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);
    expect(pipeline.manualChecks.map(({ check }) => check.id)).toStrictEqual(['docs/lychee-external', 'project/audit']);
    const cli = `npm:@gspothq/cli@${pipeline.version}`;
    const expected = `mise exec ${quoteArgument(CI_NODE)} ${quoteArgument(cli)} -- gspot check --only ${quoteArgument('docs/lychee-external,project/audit')}`;
    const github = parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow;
    expect(github.jobs['manual-linux']!.steps.some((step) => step.run?.includes(expected) === true)).toBe(true);
    expect(github.jobs['check-linux']!.steps.some((step) => step.run?.includes('--only') === true)).toBe(false);
    expect(buildGitlabWorkflow(pipeline).content).toContain(expected);
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
    expect(tokenSteps).toStrictEqual([
        'check-linux: Install gspot tools',
        'manual-linux: Install gspot tools',
        'manual-linux: Manual checks',
    ]);
});

test('a Swift scope adds the macOS jobs', async () => {
    await using resources = new AsyncDisposableStack();
    const pipeline = await buildPipeline(resources);

    const workflow = parse(buildGithubWorkflow({ ...pipeline, hasSwift: true }).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-linux', 'manual-linux', 'check-macos', 'manual-macos']);
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
                ? (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['check-linux']!.steps.flatMap(
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
        expect(await readFile(commands, 'utf8')).toBe(setupExit === 0 ? 'setup\ninstall\ncheck\n' : 'setup\n');
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
        'pyproject.toml': '[project]\nid = "service"\nversion = "1.0.0"\n',
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
