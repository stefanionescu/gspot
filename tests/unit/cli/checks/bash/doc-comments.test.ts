import { test, expect } from 'bun:test';
import { BASH_SANDBOX } from '#tests/data/checks/bash/sandbox.ts';
import { DOC_COMMENT_CASES } from '#tests/data/checks/bash/doc-comments.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const bashSandbox = shareBashSandbox();

test.each([...DOC_COMMENT_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(bashSandbox(), entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
