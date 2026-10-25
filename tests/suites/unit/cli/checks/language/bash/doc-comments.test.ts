import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';
import { DOC_COMMENT_CASES, SHEBANG_DOC_SCRIPT } from '#tests/config/checks/language/bash/doc-comments.ts';

const bashSandbox = shareBashSandbox();

test('a shebang does not become the first function summary, with or without a blank line', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'direct.sh': SHEBANG_DOC_SCRIPT,
        'spaced.sh': SHEBANG_DOC_SCRIPT.replace('bash\n', 'bash\n\n'),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/doc-comments')).toStrictEqual([]);
});

test.each([...DOC_COMMENT_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            buildExpectedSummary(sample),
        );
    },
);
