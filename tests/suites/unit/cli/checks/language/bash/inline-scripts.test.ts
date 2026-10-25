import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';
import { INLINE_SCRIPT_CASES } from '#tests/config/checks/language/bash/inline-scripts.ts';

const bashSandbox = shareBashSandbox();
test('a heredoc that writes a data file is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': '#!/usr/bin/env bash\ncat > settings.json <<EOF\n{ "name": "example" }\nEOF\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/inline-scripts')).toStrictEqual([]);
});

test.each([...INLINE_SCRIPT_CASES])(
    'bash/inline-scripts reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'bash/inline-scripts', ...row };
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            buildExpectedSummary(sample),
        );
    },
);
