// The generated CI files, read as YAML: a check job per platform, a manual job when a manual check is selected, and
// Swift on macOS.
import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { CLI_PINS } from '#cli/config/generation/pins.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { githubFile, gitlabFile } from '#cli/generation/documents/public.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/cli/generation/ci.ts';
import { PIPELINE, MISE_PROGRAM, GSPOT_PROGRAM, DOCTOR_EXIT_CODES } from '#tests/config/cli/generation/ci.ts';

test('the GitHub workflow has a check and a manual job per platform and only reads the repository', () => {
    const file = githubFile(PIPELINE);
    const workflow = parse(file.content) as GithubWorkflow;
    expect(file.path).toBe('.github/workflows/gspot.yml');
    expect(workflow.name).toBe('gspot');
    expect(workflow.permissions).toStrictEqual({ contents: 'read' });
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-linux', 'manual-linux']);
});

test.each(['security/codeql', 'project/audit'])(
    'the manual job runs %s by name while ordinary jobs retain default coverage',
    (name) => {
        const workflow = parse(githubFile({ ...PIPELINE, manualChecks: [name] }).content) as GithubWorkflow;
        const runs = workflow.jobs['manual-linux']!.steps.map((step) => step.run ?? '');
        expect(
            runs.some((run) => run.includes('mise exec -- gspot check --only ') && run.split(/\s+/u).includes(name)),
        ).toBe(true);
        expect(workflow.jobs['check-linux']!.steps.some((step) => step.run?.includes('--only') === true)).toBe(false);
        const none = parse(githubFile({ ...PIPELINE, manualChecks: [] }).content) as GithubWorkflow;
        expect(Object.keys(none.jobs)).toStrictEqual(['check-linux']);
    },
);

test('a Swift scope adds the macOS jobs', () => {
    const workflow = parse(githubFile({ ...PIPELINE, hasSwift: true }).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toContain('check-macos');
    expect(Object.keys(workflow.jobs)).toContain('manual-macos');
});

test('the GitLab include runs through mise when the runner is mise, and installs gspot from npm otherwise', () => {
    const [mise, plain] = [PIPELINE, { ...PIPELINE, isMise: false }].map(
        (pipeline) => (parse(gitlabFile(pipeline).content) as GitlabPipeline).gspot.script,
    );
    expect(mise).toContain('mise exec -- gspot install');
    expect(plain).toContain('npm install --global @gspothq/cli@1.2.3');
    expect(plain!.some((line) => line.includes('mise exec'))).toBe(false);
});

test('the GitHub workflow without mise sets up Node and installs the pinned gspot from npm', () => {
    const workflow = parse(githubFile({ ...PIPELINE, isMise: false }).content) as GithubWorkflow;
    const steps = workflow.jobs['check-linux']!.steps;
    const setup = steps.find((step) => step.uses?.startsWith('actions/setup-node@') === true);
    expect(setup?.with).toStrictEqual({ 'node-version': CLI_PINS.node });
    expect(steps.map((step) => step.run)).toContain('npm install --global @gspothq/cli@1.2.3');
});

test.each(DOCTOR_EXIT_CODES)(
    'the generated mise job runs doctor before checking and preserves doctor exit %s',
    async (doctorExit) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'bin/mise': MISE_PROGRAM, 'bin/gspot': GSPOT_PROGRAM });
        for (const name of ['mise', 'gspot']) await chmod(join(sandbox.path, 'bin', name), 0o755);
        const commands = join(sandbox.path, 'commands.log');
        const workflow = parse(githubFile({ ...PIPELINE, manualChecks: [] }).content) as GithubWorkflow;
        const script = workflow.jobs['check-linux']!.steps.flatMap((step) =>
            step.run === undefined ? [] : [step.run],
        );
        const result = await runTestCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GSPOT_COMMAND_LOG: commands,
                GSPOT_DOCTOR_EXIT: String(doctorExit),
            },
        });
        expect(result.code, result.stdout + result.stderr).toBe(doctorExit);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
        expect(await readFile(commands, 'utf8')).toBe(
            doctorExit === 0 ? 'install\ndoctor\ncheck\n' : 'install\ndoctor\n',
        );
    },
);
