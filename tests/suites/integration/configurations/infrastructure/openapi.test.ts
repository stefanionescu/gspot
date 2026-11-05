import { test } from 'bun:test';

import { OPENAPI_CASES, OPENAPI_SANDBOX } from '#tests/config/integration/infrastructure.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox(OPENAPI_SANDBOX);

test.each([...OPENAPI_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
