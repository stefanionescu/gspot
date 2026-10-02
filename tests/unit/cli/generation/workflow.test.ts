// The generated CI files, read as YAML: a check job per platform, a manual job when a manual check is selected, and
// Swift on macOS.
import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { gitlabFile, workflowFile } from '#cli/generation/ci.ts';
import type { WorkflowShape } from '#cli/types/generation/generation.ts';

const SHAPE: WorkflowShape = {
    version: '1.2.3',
    platforms: ['ubuntu'],
    swiftScope: undefined,
    isMise: true,
    manualChecks: ['security/codeql'],
};

test('the GitHub workflow has a check and a manual job per platform and only reads the repository', () => {
    const file = workflowFile(SHAPE);
    const workflow = parse(file.content) as { name: string; permissions: Record<string, string>; jobs: object };
    expect(file.path).toBe('.github/workflows/gspot.yml');
    expect(file.readOnly).toBe(true);
    expect(workflow.name).toBe('gspot');
    expect(workflow.permissions).toStrictEqual({ contents: 'read' });
    expect(Object.keys(workflow.jobs)).toStrictEqual(['check-ubuntu', 'manual-ubuntu']);
});

test('the manual job runs the selected manual checks by name, and is left out when none is selected', () => {
    const workflow = parse(workflowFile(SHAPE).content) as { jobs: Record<string, { steps: { run?: string }[] }> };
    const runs = workflow.jobs['manual-ubuntu']!.steps.map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('mise exec -- gspot check --only security/codeql'))).toBe(true);
    const none = parse(workflowFile({ ...SHAPE, manualChecks: [] }).content) as { jobs: object };
    expect(Object.keys(none.jobs)).toStrictEqual(['check-ubuntu']);
});

test('a Swift scope adds the macOS jobs', () => {
    const workflow = parse(workflowFile({ ...SHAPE, swiftScope: 'ios' }).content) as { jobs: object };
    expect(Object.keys(workflow.jobs)).toContain('check-macos');
    expect(Object.keys(workflow.jobs)).toContain('manual-macos');
});

test('the GitLab include runs through mise when the runner is mise, and installs gspot from npm otherwise', () => {
    const [mise, plain] = [SHAPE, { ...SHAPE, isMise: false }].map(
        (shape) => (parse(gitlabFile(shape).content) as { gspot: { script: string[] } }).gspot.script,
    );
    expect(mise).toContain('mise exec -- gspot install');
    expect(plain).toContain('npm install --global @gspothq/cli@1.2.3');
    expect(plain!.some((line) => line.includes('mise exec'))).toBe(false);
});

test('the GitHub workflow without mise sets up Node and installs the pinned gspot from npm', () => {
    const workflow = parse(workflowFile({ ...SHAPE, isMise: false }).content) as {
        jobs: Record<string, { steps: { uses?: string; run?: string }[] }>;
    };
    const steps = workflow.jobs['check-ubuntu']!.steps;
    expect(steps.some((step) => step.uses?.startsWith('actions/setup-node@') === true)).toBe(true);
    expect(steps.map((step) => step.run)).toContain('npm install --global @gspothq/cli@1.2.3');
});
