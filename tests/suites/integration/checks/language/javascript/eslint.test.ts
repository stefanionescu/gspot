import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { ESLINT_SANDBOX, DEBUGGER_SAMPLE } from '#tests/config/integration/checks/language/javascript/eslint.ts';

const installedSandbox = shareInstalledSandbox(ESLINT_SANDBOX);

test('javascript/eslint lints a project that has no TypeScript', async () => {
    const result = await runCheckSample(installedSandbox(), DEBUGGER_SAMPLE, ESLINT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(DEBUGGER_SAMPLE));
});
