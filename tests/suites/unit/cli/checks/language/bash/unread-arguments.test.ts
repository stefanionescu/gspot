import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { UNREAD_ARGUMENT_CASES } from '#tests/config/checks/language/bash/unread-arguments.ts';
import { BASH_SANDBOX, CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';
import { runCheckSample, expectedSummary, shareBashSandbox } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();
test('main "$@" with a main that reads no argument is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout')).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'bash/unread-arguments')).toStrictEqual([]);
});

test.each([...UNREAD_ARGUMENT_CASES])(
    'bash/unread-arguments reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'bash/unread-arguments', ...row };
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            expectedSummary(sample),
        );
    },
);
