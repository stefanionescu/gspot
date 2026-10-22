import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { TYPESCRIPT_CASES, TYPESCRIPT_SANDBOX } from '#tests/data/integration/checks/typescript/default-checks.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);
test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, TYPESCRIPT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
