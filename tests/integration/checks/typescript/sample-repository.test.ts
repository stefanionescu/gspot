import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { test, expect, beforeAll } from 'bun:test';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { TYPESCRIPT_SANDBOX } from '#tests/data/integration/checks/typescript/default-checks.ts';
import { ARCHITECTURE_SETTINGS } from '#tests/data/integration/checks/typescript/sample-repository.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

beforeAll(async () => {
    const { root, environment } = installedSandbox();
    await appendFile(join(root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
});

test('the sample TypeScript repository passes every check that init selects for it', async () => {
    const { root, environment } = installedSandbox();
    const checked = await spawnGspot(root, ['check', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});
