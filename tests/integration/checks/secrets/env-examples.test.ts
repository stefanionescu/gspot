import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { DOTENV_LINTER_CASES, DOTENV_LINTER_SANDBOX } from '#tests/data/checks/secrets.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox(DOTENV_LINTER_SANDBOX);

test.each([...DOTENV_LINTER_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, DOTENV_LINTER_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
