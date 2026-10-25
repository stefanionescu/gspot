import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';

import {
    SCRIPT_LAYOUT_CASES,
    ENVIRONMENT_READER_SCOPE_TABLES,
} from '#tests/config/checks/language/bash/script-layout.ts';

const bashSandbox = shareBashSandbox();

test('an environment reader that only its scope declares may run top-level commands', async () => {
    await using sandbox = await testdir({
        'tools/env.sh': '#!/usr/bin/env bash\nload_environment\n',
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: ENVIRONMENT_READER_SCOPE_TABLES }),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});

test.each([...SCRIPT_LAYOUT_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            expectedSummary(sample),
        );
    },
);
