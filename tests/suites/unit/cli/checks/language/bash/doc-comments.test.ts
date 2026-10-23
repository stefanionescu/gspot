import { test, expect } from 'bun:test';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { DOC_COMMENT_CASES } from '#tests/config/checks/language/bash/doc-comments.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();

test.each([...DOC_COMMENT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(bashSandbox(), sample, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
