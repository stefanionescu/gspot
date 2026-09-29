// The generated CI files: one check and one manual job per platform, Swift on macOS, SARIF upload unless turned off.
import { test, expect } from 'bun:test';
import type { WorkflowShape } from '#cli/types/generation.ts';
import { gitlabFile, workflowFile } from '#cli/generation/workflow.ts';

const SHAPE: WorkflowShape = { version: '1.2.3', platforms: ['ubuntu'], swiftScope: undefined, isMise: true };

test('the GitHub workflow has a check and a manual job per platform and uploads their SARIF', () => {
    const file = workflowFile(SHAPE);
    expect(file.path).toBe('.github/workflows/gspot.yml');
    expect(file.readOnly).toBe(true);
    expect(file.content).toContain('name: gspot');
    expect(file.content).toContain('  check-ubuntu:');
    expect(file.content).toContain('  manual-ubuntu:');
    expect(file.content).toContain('    needs: [check-ubuntu, manual-ubuntu]');
    expect(file.content).toContain('sarif_file: reports/gspot-check-ubuntu/report.sarif');
});

test('a Swift scope adds the macOS jobs, and sarif = false leaves the code scanning job out', () => {
    const swift = workflowFile({ ...SHAPE, swiftScope: 'ios' }).content;
    expect(swift).toContain('  check-macos:');
    expect(swift).toContain('    needs: [check-ubuntu, manual-ubuntu, check-macos, manual-macos]');
    const quiet = workflowFile({ ...SHAPE, sarif: false }).content;
    expect(quiet).not.toContain('code-scanning');
    expect(quiet).not.toContain('security-events');
});

test('the GitLab include runs through mise when the runner is mise, and installs gspot itself otherwise', () => {
    expect(gitlabFile(SHAPE).content).toContain('mise exec -- gspot');
    const plain = gitlabFile({ ...SHAPE, isMise: false }).content;
    expect(plain).toContain('mktemp -d');
    expect(plain).not.toContain('mise exec');
});
