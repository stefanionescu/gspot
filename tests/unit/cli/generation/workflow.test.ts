// The generated CI files: one check and one manual job per platform, and Swift on macOS.
import { test, expect } from 'bun:test';
import type { WorkflowShape } from '#cli/types/generation.ts';
import { gitlabFile, workflowFile } from '#cli/generation/ci.ts';

const SHAPE: WorkflowShape = { version: '1.2.3', platforms: ['ubuntu'], swiftScope: undefined, isMise: true };

test('the GitHub workflow has a check and a manual job per platform and only reads the repository', () => {
    const file = workflowFile(SHAPE);
    expect(file.path).toBe('.github/workflows/gspot.yml');
    expect(file.readOnly).toBe(true);
    expect(file.content).toContain('name: gspot');
    expect(file.content).toContain('  check-ubuntu:');
    expect(file.content).toContain('  manual-ubuntu:');
    expect(file.content).not.toContain('security-events');
    expect(file.content).not.toContain('upload-artifact');
});

test('a Swift scope adds the macOS jobs', () => {
    const swift = workflowFile({ ...SHAPE, swiftScope: 'ios' }).content;
    expect(swift).toContain('  check-macos:');
    expect(swift).toContain('  manual-macos:');
});

test('the GitLab include runs through mise when the runner is mise, and installs gspot from npm otherwise', () => {
    expect(gitlabFile(SHAPE).content).toContain('mise exec -- gspot');
    const plain = gitlabFile({ ...SHAPE, isMise: false }).content;
    expect(plain).toContain('npm install --global @gspothq/cli@1.2.3');
    expect(plain).not.toContain('mise exec');
});

test('the GitHub workflow without mise sets up Node and installs the pinned gspot from npm', () => {
    const plain = workflowFile({ ...SHAPE, isMise: false }).content;
    expect(plain).toContain('actions/setup-node@');
    expect(plain).toContain('npm install --global @gspothq/cli@1.2.3');
    expect(plain).not.toContain('releases/download');
});
