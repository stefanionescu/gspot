import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/configurations/tools.ts';

test.each([...TOOL_PROJECT_PACKAGES])('the $name installers give the tool project package $expected', (entry) => {
    const tool = { ...buildProgramPin(entry.tool, entry.version), system: entry.system, installers: entry.installers };
    const placement = findToolProjectPackage(tool);
    expect(placement).toStrictEqual(entry.expected);
});
