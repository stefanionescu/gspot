import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { TRAP_FUNCTION_SOURCE, UNUSED_FUNCTION_CASES } from '#tests/data/checks/bash/unused-functions.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();
test('a function that only a trap runs is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': TRAP_FUNCTION_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each([...UNUSED_FUNCTION_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(bashSandbox(), entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
