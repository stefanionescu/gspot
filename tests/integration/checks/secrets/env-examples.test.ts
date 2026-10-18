import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { ENV_EXAMPLES_CASES, ENV_EXAMPLES_SANDBOX } from '#tests/data/checks/secrets.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox(ENV_EXAMPLES_SANDBOX);

test.each([...ENV_EXAMPLES_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, ENV_EXAMPLES_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
