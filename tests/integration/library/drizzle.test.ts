import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { DRIZZLE_CASE, LIBRARY_SANDBOX } from '#tests/config/libraries.ts';

const installedSandbox = shareInstalledSandbox({ ...LIBRARY_SANDBOX, configurations: ['typescript', 'drizzle'] });

test('drizzle reports its rule and passes after the fix', async () => {
    await runCheckSample(installedSandbox(), DRIZZLE_CASE, LIBRARY_SANDBOX);
});
