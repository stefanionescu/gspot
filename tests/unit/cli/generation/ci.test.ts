import { parse } from 'yaml';
import { join, delimiter } from 'node:path';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { quoteArgument } from '#cli/system/text.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { Pipeline } from '#cli/types/generation/ci.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { githubFile, gitlabFile } from '#cli/generation/ci.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/ci.ts';

import {
    SETUP_CASES,
    MISE_PROGRAM,
    GSPOT_PROGRAM,
    SETUP_PROGRAM,
    LINUX_PIPELINE,
    SETUP_ARGUMENTS,
} from '#tests/config/ci.ts';

let PIPELINE: Pipeline;
let preparation: AsyncDisposableStack;
beforeAll(async () => {
    preparation = new AsyncDisposableStack();
    const sandbox = preparation.use(
        await testdir({
            'gspot.toml': settingsText(['docs'], {
                tables: '[[command_check]]\nname = "project/audit"\npaths = ["**/*"]\nstage = "manual"\ncommand = ["echo", "sample"]\n',
            }),
            'README.md': '# Example\n',
            'package.json': '{"private":true,"packageManager":"npm@11.10.1"}',
        }),
    );
    const session = await openSession(sandbox.path);
    const client = session.getPackageManager();
    PIPELINE = {
        ...LINUX_PIPELINE,
        operatingSystems: [...LINUX_PIPELINE.operatingSystems],
        manualChecks: session.configuredChecks.filter(({ check }) => check.name === 'docs/lychee-external'),
        manualTools: session.manifests.get('docs')!.tools.filter((tool) => tool.name === 'lychee'),
        ...(client === undefined ? {} : { npmClient: client }),
    };
    PIPELINE.manualChecks.push(...session.configuredChecks.filter(({ check }) => check.name === 'project/audit'));
});
afterAll(async () => {
    await preparation.disposeAsync();
});

test('the GitHub workflow has a check job and a manual job per operating system, and no manual job without manual checks', () => {
    const file = githubFile({
        ...PIPELINE,
        manualChecks: PIPELINE.manualChecks.filter(({ check }) => check.name === 'docs/lychee-external'),
    });
    const workflow = parse(file.content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-linux', 'manual-linux']);
    const none = parse(githubFile({ ...PIPELINE, manualChecks: [] }).content) as GithubWorkflow;
    expect(Object.keys(none.jobs)).toStrictEqual(['check-linux']);
});

test.each(['docs/lychee-external', 'project/audit'])(
    'the manual job runs %s by name and the check job runs every check',
    (name) => {
        const workflow = parse(
            githubFile({
                ...PIPELINE,
                manualChecks: PIPELINE.manualChecks.filter(({ check }) => check.name === name),
                manualTools: name === 'docs/lychee-external' ? PIPELINE.manualTools : [],
            }).content,
        ) as GithubWorkflow;
        const runs = workflow.jobs['manual-linux']!.steps.map((step) => step.run ?? '');
        const cli = quoteArgument(`npm:@gspothq/cli@${PIPELINE.version}`);
        expect(
            runs.some((run) =>
                run.includes(
                    `mise exec ${quoteArgument('node@24')} ${cli} -- gspot check --only ${quoteArgument(name)}`,
                ),
            ),
        ).toBe(true);
        expect(workflow.jobs['check-linux']!.steps.some((step) => step.run?.includes('--only') === true)).toBe(false);
    },
);

test('a Swift scope adds the macOS jobs', () => {
    const workflow = parse(githubFile({ ...PIPELINE, hasSwift: true }).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toContain('check-macos');
    expect(Object.keys(workflow.jobs)).toContain('manual-macos');
});

test.each(SETUP_CASES)(
    'the %s job keeps setup exit %s and literal arguments before gspot',
    async (provider, setupExit) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'bin/mise': MISE_PROGRAM,
            'bin/gspot': GSPOT_PROGRAM,
            'bin/project setup': SETUP_PROGRAM,
        });
        for (const name of ['mise', 'gspot', 'project setup']) await chmod(join(sandbox.path, 'bin', name), 0o755);
        const commands = join(sandbox.path, 'commands.log');
        const argumentsPath = join(sandbox.path, 'arguments.log');
        const pipeline = {
            ...PIPELINE,
            manualChecks: [],
            manualTools: [],
            setupCommand: [join(sandbox.path, 'bin', 'project setup'), ...SETUP_ARGUMENTS],
        };
        const script =
            provider === 'github'
                ? (parse(githubFile(pipeline).content) as GithubWorkflow).jobs['check-linux']!.steps.flatMap((step) =>
                      step.run === undefined ? [] : [step.run],
                  )
                : (parse(gitlabFile(pipeline).content) as GitlabPipeline).gspot.script;
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
        expect(await Bun.file(join(sandbox.path, 'unexpected')).exists()).toBe(false);
    },
);
