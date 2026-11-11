import { test } from 'bun:test';

import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { FILE_FOLDER_CLASH_SAMPLE } from '#tests/config/configurations/structure/files.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';

test('structure/file-folder-clashes reports file-folder-clash in jobs/turn.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(sandbox, FILE_FOLDER_CLASH_SAMPLE, BASH_SANDBOX.cleanSource);
});
