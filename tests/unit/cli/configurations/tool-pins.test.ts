import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/pins.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/config/manifests.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';

test.each([...TOOL_PROJECT_PACKAGES])(
    'the $name installers give the tool project kind and the exact version',
    (entry) => {
        const tool = { ...buildProgramPin(entry.tool, entry.version), installers: entry.installers };
        const placement = findToolProjectPackage(tool);
        expect(
            placement === undefined ? undefined : { kind: placement.kind, version: placement.version },
        ).toStrictEqual(entry.expected);
    },
);
