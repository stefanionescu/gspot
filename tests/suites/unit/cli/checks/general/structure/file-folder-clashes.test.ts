import { test } from 'bun:test';
import { expectSampleFix } from '#tests/setup/cli/samples.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/config/checks/general/structure/file-folder-clashes.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await expectSampleFix(BASH_SANDBOX, sample);
    },
);
