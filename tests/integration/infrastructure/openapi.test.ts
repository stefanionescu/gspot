import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { OPENAPI_CASES, OPENAPI_SANDBOX } from '#tests/config/openapi.ts';

const installedSandbox = shareInstalledSandbox(OPENAPI_SANDBOX);

test.each([...OPENAPI_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await runCheckSample(installedSandbox(), entry, OPENAPI_SANDBOX);
});
