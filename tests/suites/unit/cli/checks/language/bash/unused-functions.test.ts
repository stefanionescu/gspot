import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';

import {
    TRAP_SCRIPT_FORMS,
    TRAP_FUNCTION_SOURCE,
    UNUSED_FUNCTION_CASES,
} from '#tests/config/checks/language/bash/unused-functions.ts';

const bashSandbox = shareBashSandbox();
test.each(TRAP_SCRIPT_FORMS)('a function called by trap %s is not reported', async (script) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': TRAP_FUNCTION_SOURCE.replace('trap _cleanup EXIT', () => `trap ${script} EXIT`),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each([...UNUSED_FUNCTION_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            buildExpectedSummary(sample),
        );
    },
);
