import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { INLINE_SCRIPT_CASES } from '#tests/data/checks/bash/inline-scripts.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();
test('a heredoc that writes a data file is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': '#!/usr/bin/env bash\ncat > settings.json <<EOF\n{ "name": "example" }\nEOF\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/inline-scripts')).toStrictEqual([]);
});

test.each([...INLINE_SCRIPT_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(bashSandbox(), entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
