import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeAll, describe, expect, test } from 'bun:test';

import { ARCHITECTURE_SETTINGS, TYPESCRIPT_CASES, TYPESCRIPT_SANDBOX } from '#tests/config/integration/typescript.ts';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

describe('after the shared TypeScript sandbox installs its tools', () => {
    const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

    beforeAll(async () => {
        await appendFile(join(installedSandbox().root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
        await applyGeneratedFiles(installedSandbox().root);
    });

    test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        await assertCheckSample(installedSandbox(), sample);
    });

    test('the sample TypeScript repository passes every check that init selects for it', async () => {
        const { root } = installedSandbox();
        const checked = await spawnGspot(root, ['check', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    });
});
