import { test, expect } from 'bun:test';
import { buildBinaryPin } from '#tests/harness/pins.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import { PRIVATE_INSTALLATIONS } from '#tests/config/cli/tools/installation.ts';

test.each([...PRIVATE_INSTALLATIONS])(
    'the declared $name installer has the expected location and exact version',
    (entry) => {
        const tool = { ...buildBinaryPin(entry.tool, entry.version), installers: entry.installers };
        const placement = privateToolInstallation(tool, entry.runner);
        expect(
            placement === undefined ? undefined : { kind: placement.kind, version: placement.version },
        ).toStrictEqual(entry.expected);
    },
);
