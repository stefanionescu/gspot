import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { DOC_COMMENT_CASES, SHEBANG_DOC_SCRIPT } from '#tests/config/checks/language/bash/doc-comments.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();

test('a shebang does not become the first function summary, with or without a blank line', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'direct.sh': SHEBANG_DOC_SCRIPT,
        'spaced.sh': SHEBANG_DOC_SCRIPT.replace('bash\n', 'bash\n\n'),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/doc-comments')).toStrictEqual([]);
});

test.each([...DOC_COMMENT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(bashSandbox(), sample, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
