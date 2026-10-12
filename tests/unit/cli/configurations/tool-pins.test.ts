import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/pins.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/manifests.ts';
import { toolProjectPackage } from '#cli/configurations/tool-pins.ts';

test.each([...TOOL_PROJECT_PACKAGES])(
    'the $name installers give the tool project kind and the exact version',
    (entry) => {
        const tool = { ...buildProgramPin(entry.tool, entry.version), installers: entry.installers };
        const placement = toolProjectPackage(tool);
        expect(
            placement === undefined ? undefined : { kind: placement.kind, version: placement.version },
        ).toStrictEqual(entry.expected);
    },
);
