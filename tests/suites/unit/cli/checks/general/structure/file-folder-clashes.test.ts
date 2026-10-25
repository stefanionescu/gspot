import { test, expect } from 'bun:test';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/config/checks/general/structure/file-folder-clashes.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        expect(await runCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource)).toStrictEqual(expectedSummary(sample));
    },
);
