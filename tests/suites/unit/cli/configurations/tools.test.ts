import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/configurations/tools.ts';
import { hasRuleOutput, findMissingBuild, findToolProjectPackage } from '#cli/configurations/tools.ts';

test.each([...TOOL_PROJECT_PACKAGES])('the $name installers give the tool project package $expected', (row) => {
    const tool = { ...buildProgramPin(row.tool, row.version), system: row.system, installers: row.installers };
    const placement = findToolProjectPackage(tool);
    expect(placement).toStrictEqual(row.expected);
});

test('missing tool builds distinguish the platform from its architecture and allow unrestricted tools', () => {
    const tool = buildProgramPin('example', '0.0.0-test');
    const host = { platform: 'macos', arch: 'arm64' } as const;
    expect(findMissingBuild({ ...tool, builds: ['linux-x64'] }, host)).toBe('macOS');
    expect(findMissingBuild({ ...tool, builds: ['macos-x64'] }, host)).toBe('arm64 macOS');
    expect(findMissingBuild(tool, host)).toBeUndefined();
});

test('only Bash checks with rule IDs advertise rule output', () => {
    const checks = readConfigurations().get('bash')?.checks;
    expect(checks).toBeDefined();
    expect(
        hasRuleOutput(checks?.find((check) => check.id === 'bash/zsh-syntax') as NonNullable<typeof checks>[number]),
    ).toBe(false);
    expect(
        hasRuleOutput(checks?.find((check) => check.id === 'bash/shellcheck') as NonNullable<typeof checks>[number]),
    ).toBe(true);
});
