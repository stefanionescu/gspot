import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/manifests.ts';
import { findMissingBuild, findToolProjectPackage } from '#cli/manifests/tools.ts';

test.each([...TOOL_PROJECT_PACKAGES])('$name: the installers give the expected tool project package', (row) => {
    const tool = { ...buildProgramPin(row.tool, row.version), system: row.system, installers: row.installers };
    const placement = findToolProjectPackage(tool);
    expect(placement).toStrictEqual(row.expected);
});

test('missing tool builds name the operating system and allow unrestricted tools', () => {
    const tool = buildProgramPin('example', '0.0.0-test');
    const host = { platform: 'macos', arch: 'arm64' } as const;
    expect(findMissingBuild({ ...tool, builds: ['linux'] }, host)).toBe('macOS');
    expect(findMissingBuild(tool, host)).toBeUndefined();
});
