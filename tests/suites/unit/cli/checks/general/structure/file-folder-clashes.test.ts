import { test } from 'bun:test';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/config/checks/general/structure/file-folder-clashes.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);
