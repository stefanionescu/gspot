import { test, expect, beforeAll } from 'bun:test';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { appendSandboxSettings } from '#tests/setup/sandboxes/changes.ts';

import {
    TYPESCRIPT_SANDBOX,
    ARCHITECTURE_SETTINGS,
} from '#tests/config/integration/checks/language/typescript/samples.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

beforeAll(() => appendSandboxSettings(installedSandbox(), ARCHITECTURE_SETTINGS));

test('the sample TypeScript repository passes every check that init selects for it', async () => {
    const { root, environment } = installedSandbox();
    const checked = await spawnGspot(root, ['check', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});
