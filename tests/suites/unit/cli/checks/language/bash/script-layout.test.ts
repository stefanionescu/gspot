import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    SCRIPT_LAYOUT_CASES,
    ENVIRONMENT_READER_SCOPE_FILES,
    ENVIRONMENT_READER_SCOPE_TABLES,
} from '#tests/config/checks/language/bash/script-layout.ts';

const bashSandbox = shareBashSandbox();
test('an environment reader that only its scope declares may run top-level commands', async () => {
    await using sandbox = await testdir({
        ...ENVIRONMENT_READER_SCOPE_FILES,
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: ENVIRONMENT_READER_SCOPE_TABLES }),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});

test.each([...SCRIPT_LAYOUT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(bashSandbox(), sample, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
