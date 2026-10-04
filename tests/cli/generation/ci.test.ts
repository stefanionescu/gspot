// The generated CI files, read as YAML: a check job per platform, a manual job when a manual check is selected, and
// Swift on macOS.
import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { NODE_VERSION } from '#cli/config/generation/ci.ts';
import { githubFile, gitlabFile } from '#cli/generation/ci.ts';
import { SHAPE } from '#tests/config/cli/generation/workflow.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/generation/workflow.ts';

test('the GitHub workflow has a check and a manual job per platform and only reads the repository', () => {
    const file = githubFile(SHAPE);
    const workflow = parse(file.content) as GithubWorkflow;
    expect(file.path).toBe('.github/workflows/gspot.yml');
    expect(file.readOnly).toBe(true);
    expect(workflow.name).toBe('gspot');
    expect(workflow.permissions).toStrictEqual({ contents: 'read' });
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-linux', 'manual-linux']);
});

test('the manual job runs the selected manual checks by name, and is left out when none is selected', () => {
    const workflow = parse(githubFile(SHAPE).content) as GithubWorkflow;
    const runs = workflow.jobs['manual-linux']!.steps.map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('mise exec -- gspot check --only security/codeql'))).toBe(true);
    const none = parse(githubFile({ ...SHAPE, manualChecks: [] }).content) as GithubWorkflow;
    expect(Object.keys(none.jobs)).toStrictEqual(['check-linux']);
});

test('a Swift scope adds the macOS jobs', () => {
    const workflow = parse(githubFile({ ...SHAPE, swiftScope: 'ios' }).content) as GithubWorkflow;
    expect(Object.keys(workflow.jobs)).toContain('check-macos');
    expect(Object.keys(workflow.jobs)).toContain('manual-macos');
});

test('the GitLab include runs through mise when the runner is mise, and installs gspot from npm otherwise', () => {
    const [mise, plain] = [SHAPE, { ...SHAPE, isMise: false }].map(
        (shape) => (parse(gitlabFile(shape).content) as GitlabPipeline).gspot.script,
    );
    expect(mise).toContain('mise exec -- gspot install');
    expect(plain).toContain('npm install --global @gspothq/cli@1.2.3');
    expect(plain!.some((line) => line.includes('mise exec'))).toBe(false);
});

test('the GitHub workflow without mise sets up Node and installs the pinned gspot from npm', () => {
    const workflow = parse(githubFile({ ...SHAPE, isMise: false }).content) as GithubWorkflow;
    const steps = workflow.jobs['check-linux']!.steps;
    const setup = steps.find((step) => step.uses?.startsWith('actions/setup-node@') === true);
    expect(setup?.with).toStrictEqual({ 'node-version': NODE_VERSION });
    expect(steps.map((step) => step.run)).toContain('npm install --global @gspothq/cli@1.2.3');
});
