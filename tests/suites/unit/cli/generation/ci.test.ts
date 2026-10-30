import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import type { Pipeline } from '#cli/types/generation/ci.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/typescript.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { type GithubWorkflow, type GitlabPipeline } from '#tests/types/ci.ts';
import { CI_NODE, GITHUB_EXPRESSION_MESSAGE } from '#cli/config/generation/ci.ts';
import { buildGithubWorkflow, buildGitlabWorkflow, listProjectInstallLines } from '#cli/generation/ci.ts';
import { LINT_STEPS, SETUP_CASES, LINUX_PIPELINE, SETUP_ARGUMENTS } from '#tests/config/generation/ci.ts';

test('the GitHub workflow runs one lint job and gives the GitHub token to the gspot install only', () => {
    const workflow = parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow;
    const steps = workflow.jobs['lint']!.steps;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['lint']);
    expect(steps.map((step) => step.name)).toStrictEqual([...LINT_STEPS]);
    expect(
        steps.filter((step) => step.env?.['MISE_GITHUB_TOKEN'] !== undefined).map((step) => step.name),
    ).toStrictEqual(['Install gspot']);
});

test.each<Partial<Pipeline>>([
    { setupCommand: ['echo', '${{ secrets.DEPLOY_KEY }}'] },
    { projectInstall: ['(cd ${{ github.head_ref }} && npm ci)'] },
])('the GitHub workflow refuses a command that holds a GitHub expression', (fields) => {
    expect(() => buildGithubWorkflow({ ...LINUX_PIPELINE, ...fields })).toThrow(
        new GspotError('settings', GITHUB_EXPRESSION_MESSAGE),
    );
});

test('pushes run the GitHub job on the default branch only', () => {
    const job = (parse(buildGithubWorkflow(LINUX_PIPELINE).content) as GithubWorkflow).jobs['lint']!;
    expect(job.if).toBe("github.event_name != 'push' || github.ref_name == github.event.repository.default_branch");
    expect(job.steps.filter((step) => step.if === "github.event_name == 'push'")).toStrictEqual([]);
});

test('the cache key covers version and lockfiles without restoring another key, and escapes apostrophes', () => {
    const steps = (
        parse(
            buildGithubWorkflow({ ...LINUX_PIPELINE, lockfiles: [...LINUX_PIPELINE.lockfiles, "team's/bun.lock"] })
                .content,
        ) as GithubWorkflow
    ).jobs['lint']!.steps;
    const restore = steps.find((step) => step.name === 'Restore caches')!;
    expect(restore.with?.['key']).toBe(
        "gspot-${{ runner.os }}-${{ runner.arch }}-1.2.3-${{ hashFiles('.gspot/package.json', '.gspot/*lock*', '.gspot/pyproject.toml', '.gspot/mise.toml', 'package-lock.json', 'web/pnpm-lock.yaml', 'team''s/bun.lock') }}",
    );
    expect(restore.with?.['restore-keys']).toBeUndefined();
    expect(restore.with?.['path']).toBe('~/.cache/mise/downloads-cas\n~/.npm/_cacache\n~/.local/share/pnpm/store\n');
    const save = steps.find((step) => step.name === 'Save caches')!;
    expect(save).toMatchObject({
        if: "steps.cache.outputs.cache-hit != 'true'",
        with: { key: '${{ steps.cache.outputs.cache-primary-key }}', path: restore.with?.['path'] },
    });
});

test('a Swift scope adds a macOS job, each job names its system, and the Linux job uses the Linux runner', () => {
    const pipeline = LINUX_PIPELINE;

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
        const pipeline = LINUX_PIPELINE;
        await using sandbox = await createGitSandbox({ '.gspot/version': '1.2.3' });
        runGitStep(sandbox.path, ['add', '.gspot/version']);
        const commands = join(sandbox.path, 'commands.log');
        const bin = await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/tool');
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
            env: {
                PATH: `${bin}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
                GITHUB_PATH: join(sandbox.path, 'github-path'),
            },
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
        'web/next.config.ts': EMPTY_DEFAULT_SOURCE,
        'main.py': 'value = 1\n',
        'web/app/page.tsx': 'export default function Page() { return null; }\n',
    });

    const session = await openSession(sandbox.path);
    const uv = session.configurationsByName.get('python')!.tools.find(({ name }) => name === 'uv')?.version;
    expect(listProjectInstallLines(session)).toStrictEqual([
        `mise exec ${CI_NODE} npm@11.10.1 -- npm ci`,
        `mise exec ${CI_NODE} uv@${String(uv)} -- uv sync --locked`,
        `(cd web && mise exec ${CI_NODE} pnpm@10.30.0 -- pnpm install --frozen-lockfile)`,
        '(cd web && npx --no -- next typegen)',
    ]);
});

test('the GitHub workflow pins each action to a full commit and names its version in a comment', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[ci]\nenabled = true\nprovider = "github"\n' }),
    });
    const content = generateFiles(await openSession(sandbox.path)).files.find(
        ({ path }) => path === '.github/workflows/gspot.yml',
    )!.content;
    const workflow = parse(content) as GithubWorkflow;
    const actions = Object.values(workflow.jobs).flatMap(({ steps }) => steps.filter(({ uses }) => uses !== undefined));
    const lines = content.split('\n').filter((line) => /\buses:/u.test(line));
    expect(actions.map(({ uses }) => uses?.split('@', 1)[0])).toStrictEqual([
        'actions/checkout',
        'actions/cache/restore',
        'jdx/mise-action',
        'actions/cache/save',
    ]);
    expect(lines).toHaveLength(actions.length);
    for (const line of lines)
        expect(line).toMatch(/^\s+(?:- )?uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(?:\.\d+)*$/u);
});
