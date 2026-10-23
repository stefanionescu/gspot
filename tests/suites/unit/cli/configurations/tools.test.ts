import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/configurations/tools.ts';

test.each([...TOOL_PROJECT_PACKAGES])('the $name installers give the tool project package $expected', (row) => {
    const tool = { ...buildProgramPin(row.tool, row.version), system: row.system, installers: row.installers };
    const placement = findToolProjectPackage(tool);
    expect(placement).toStrictEqual(row.expected);
});
