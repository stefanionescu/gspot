import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { OPENAPI_CASES, OPENAPI_SANDBOX } from '#tests/data/integration/checks/openapi.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const installedSandbox = shareInstalledSandbox(OPENAPI_SANDBOX);

test.each([...OPENAPI_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, OPENAPI_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
