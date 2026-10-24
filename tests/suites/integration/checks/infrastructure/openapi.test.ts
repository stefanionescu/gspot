import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';
import { OPENAPI_CASES, OPENAPI_SANDBOX } from '#tests/config/integration/checks/infrastructure/openapi.ts';

const installedSandbox = shareInstalledSandbox(OPENAPI_SANDBOX);

test.each([...OPENAPI_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    expect(await runCheckSample(installedSandbox(), sample)).toStrictEqual(expectedSummary(sample));
});
