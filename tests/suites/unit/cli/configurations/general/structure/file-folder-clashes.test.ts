import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/config/configurations/structure/files.ts';

test.each([...FILE_FOLDER_CLASH_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);
