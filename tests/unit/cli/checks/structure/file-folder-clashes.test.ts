import { test, expect } from 'bun:test';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/sandbox.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/data/checks/structure/file-folder-clashes.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

test.each([...FILE_FOLDER_CLASH_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    const result = await runCheckSample(sandbox, entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
