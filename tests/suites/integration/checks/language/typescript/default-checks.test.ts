import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { test, expect, beforeAll } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

import {
    TYPESCRIPT_CASES,
    TYPESCRIPT_SANDBOX,
    ARCHITECTURE_SETTINGS,
} from '#tests/config/integration/checks/language/typescript.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

beforeAll(async () => {
    await appendFile(join(installedSandbox().root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
    await runGspotStep(installedSandbox(), ['apply']);
});

test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});

test('the sample TypeScript repository passes every check that init selects for it', async () => {
    const { root } = installedSandbox();
    const checked = await spawnGspot(root, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});
