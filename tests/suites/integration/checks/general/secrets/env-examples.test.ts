import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    DOTENV_LINTER_CASES,
    DOTENV_LINTER_SANDBOX,
} from '#tests/config/integration/checks/general/secrets/env-examples.ts';

const installedSandbox = shareInstalledSandbox(DOTENV_LINTER_SANDBOX);

test.each([...DOTENV_LINTER_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, DOTENV_LINTER_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
