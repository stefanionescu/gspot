import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { ZUSTAND_CASE, LIBRARY_SANDBOX } from '#tests/config/libraries.ts';

const installedSandbox = shareInstalledSandbox({ ...LIBRARY_SANDBOX, configurations: ['typescript', 'zustand'] });

test('zustand reports its rule and passes after the fix', async () => {
    await runCheckSample(installedSandbox(), ZUSTAND_CASE, LIBRARY_SANDBOX);
});
