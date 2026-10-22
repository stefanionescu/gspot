import { test, expect, beforeAll } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { appendSandboxSettings } from '#tests/setup/sandboxes/changes.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { TYPESCRIPT_CASES } from '#tests/config/integration/checks/language/typescript/default-checks.ts';

import {
    TYPESCRIPT_SANDBOX,
    ARCHITECTURE_SETTINGS,
} from '#tests/config/integration/checks/language/typescript/samples.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

beforeAll(() => appendSandboxSettings(installedSandbox(), ARCHITECTURE_SETTINGS));
test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, TYPESCRIPT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
