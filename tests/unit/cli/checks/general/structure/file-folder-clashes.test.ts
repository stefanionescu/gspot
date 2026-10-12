import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { FILE_FOLDER_CLASH_CASES } from '#tests/config/structure/folders.ts';

for (const entry of FILE_FOLDER_CLASH_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(BASH_REPOSITORY);
        await runCheckSample(sandbox, entry, BASH_REPOSITORY);
    });
}
