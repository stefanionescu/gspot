import { test, expect } from 'bun:test';
import { buildProgramPin } from '#tests/setup/builders.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { TOOL_PROJECT_PACKAGES } from '#tests/data/configurations/manifests.ts';

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
