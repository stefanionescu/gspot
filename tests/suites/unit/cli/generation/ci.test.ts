import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { type Pipeline } from '#cli/types/generation/ci.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { type GithubWorkflow, type GitlabPipeline } from '#tests/types/ci.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';
import { LINT_STEPS, SETUP_CASES, LINUX_PIPELINE, SETUP_ARGUMENTS } from '#tests/config/generation/ci.ts';

async function buildPipeline(): Promise<Pipeline> {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], {
            tables: stringify({
                command_check: [{ id: 'project/audit', paths: ['**/*'], stage: 'manual', command: ['echo', 'sample'] }],
            }),
        }),
        'README.md': '# Example\n',
        'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
    });
    const session = await openSession(sandbox.path);
    return {
        ...LINUX_PIPELINE,
        manualChecks: session.configuredChecks.filter(({ check }) =>
            ['docs/lychee-external', 'project/audit'].includes(check.id),
        ),
        tools: session.configurationsByName.get('docs')!.tools.filter((tool) => tool.name === 'lychee'),
    };
}

test('the GitHub workflow has one lint job, which ends with the slow checks only when there are some', async () => {
    const pipeline = await buildPipeline();

    const workflow = parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint']);
    expect(workflow.jobs['lint']!.steps.map((step) => step.name)).toStrictEqual([...LINT_STEPS]);
    const none = parse(buildGithubWorkflow({ ...pipeline, manualChecks: [] }).content) as GithubWorkflow;
    expect(none.jobs['lint']!.steps.map((step) => step.name)).toStrictEqual(LINT_STEPS.slice(0, -1));
});

test('the Slow checks step names every slow check in one comma list', async () => {
    const pipeline = await buildPipeline();
    const command = "mise exec node@24 'npm:@gspothq/cli[allow_low_downloads=true]@1.2.3' -- gspot";
    const expected = `${command} check --only 'docs/lychee-external,project/audit'`;
    const steps = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps;
    expect(steps.find((step) => step.name === 'Install gspot tools')?.run).toBe(`${command} install`);
    expect(steps.find((step) => step.name === 'Slow checks')?.run).toBe(
        `(cd ${GSPOT_FOLDER} && mise install lychee)\n${expected}\n`,
    );
    expect(steps.find((step) => step.name === 'Lint')?.run).toBe(`${command} check --changed "\${GSPOT_CI_BASE}"\n`);
    expect(buildGitlabWorkflow(pipeline).content).toContain(expected);
    expect((parse(buildGitlabWorkflow(pipeline).content) as GitlabPipeline).gspot.script).toContain(
        `${command} install`,
    );
});

test('pushes run the job on the default branch only, and the slow checks only on those pushes', async () => {
    const pipeline = await buildPipeline();

    const job = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!;
    expect(job.if).toBe("github.event_name != 'push' || github.ref_name == github.event.repository.default_branch");
    expect(
        job.steps.filter((step) => step.if === "github.event_name == 'push'").map((step) => step.name),
    ).toStrictEqual(['Slow checks']);
});

test('the cache key covers the gspot version, the tool files, and the project lockfiles, and the cache is saved before the checks', async () => {
    const pipeline = await buildPipeline();

    const steps = (parse(buildGithubWorkflow(pipeline).content) as GithubWorkflow).jobs['lint']!.steps;
    const restore = steps.find((step) => step.name === 'Restore caches')!;
    expect(restore.with?.['key']).toBe(
        "gspot-${{ runner.os }}-${{ runner.arch }}-1.2.3-${{ hashFiles('.gspot/package.json', '.gspot/*lock*', '.gspot/pyproject.toml', '.gspot/mise.toml', '.gspot/mise.lock', 'package-lock.json', 'web/pnpm-lock.yaml') }}",
    );
    expect(restore.with?.['restore-keys']).toBe('gspot-${{ runner.os }}-${{ runner.arch }}-');
    const save = steps.find((step) => step.name === 'Save caches')!;
    expect(save).toMatchObject({
        if: `steps.${restore.id ?? ''}.outputs.cache-hit != 'true'`,
        with: { key: `\${{ steps.${restore.id ?? ''}.outputs.cache-primary-key }}`, path: restore.with?.['path'] },
    });
});

test('only the steps that install tools receive the GitHub token for mise', async () => {
    const pipeline = await buildPipeline();

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

test('a Swift scope adds a macOS job, each job names its system, and the Linux job uses the Linux runner', async () => {
    const pipeline = await buildPipeline();

    const workflow = parse(
        buildGithubWorkflow({ ...pipeline, hasSwift: true, linuxRunner: 'linux-large' }).content,
    ) as GithubWorkflow;
    expect(
        Object.entries(workflow.jobs).map(([id, job]) => ({ id, name: job.name, runner: job['runs-on'] })),
    ).toStrictEqual([
        { id: 'lint-linux', name: 'lint (linux)', runner: 'linux-large' },
        { id: 'lint-macos', name: 'lint (macos)', runner: 'macos-26' },
    ]);
});

test.each([...SETUP_CASES])(
    'the %s job keeps setup exit %i and literal arguments before gspot',
    async (provider, setupExit) => {
        const pipeline = await buildPipeline();
        await using sandbox = await testdir();
        const commands = join(sandbox.path, 'commands.log');
        const bin = await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/exec');
        await writeProgramCommand(sandbox.path, 'bin/gspot', 'fakes/tool', '--log-arguments', commands, '--');
        await writeProgramCommand(
            sandbox.path,
            'bin/project setup',
            'fakes/tool',
            '--log-arguments',
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
            manualChecks: [],
            tools: [],
            setupCommand: [join(bin, 'project setup'), ...SETUP_ARGUMENTS],
        };
        const script =
            provider === 'github'
                ? (parse(buildGithubWorkflow(setupPipeline).content) as GithubWorkflow).jobs['lint']!.steps.flatMap(
                      (step) => (step.run === undefined ? [] : step.run),
                  )
                : (parse(buildGitlabWorkflow(setupPipeline).content) as GitlabPipeline).gspot.script;
        const result = await runCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: { PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}` },
        });
        expect(result.code, result.stdout + result.stderr).toBe(setupExit);
        expect(result.stdout).toBe('setup out\n');
        expect(result.stderr).toBe('setup err\n');
        const gspotCalls = setupExit === 0 ? '["install"]\n["check","--changed",""]\n' : '';
        expect(await readFile(commands, 'utf8')).toBe(`${JSON.stringify(SETUP_ARGUMENTS)}\n${gspotCalls}`);
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
        'web/package.json': '{"private":true,"packageManager":"pnpm@10.30.0","dependencies":{"next":"16.0.0"}}',
        'web/pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'web/next.config.ts': 'export default {};\n',
        'main.py': 'value = 1\n',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });

    const session = await openSession(sandbox.path);
    const uv = session.configurationsByName.get('python')!.tools.find(({ name }) => name === 'uv')?.version;
    expect(listProjectInstallLines(session)).toStrictEqual([
        'mise exec node@24 npm@11.10.1 -- npm ci',
        `mise exec node@24 uv@${String(uv)} -- uv sync --locked`,
        '(cd web && mise exec node@24 pnpm@10.30.0 -- pnpm install --frozen-lockfile)',
        '(cd web && npx --no -- next typegen)',
    ]);
});
