import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { TRAP_FUNCTION_SOURCE, UNUSED_FUNCTION_CASES } from '#tests/config/checks/language/bash/unused-functions.ts';

const bashSandbox = shareBashSandbox();
test('a function that only a trap runs is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': TRAP_FUNCTION_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each([...UNUSED_FUNCTION_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(bashSandbox(), sample, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
