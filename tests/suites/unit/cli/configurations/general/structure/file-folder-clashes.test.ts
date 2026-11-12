import { expect, test } from 'bun:test';

import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { FILE_FOLDER_CLASH_SAMPLE } from '#tests/config/configurations/structure/files.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('structure/file-folder-clashes reports file-folder-clash in jobs/turn.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(sandbox, FILE_FOLDER_CLASH_SAMPLE, BASH_SANDBOX.cleanSource);
});

test('a Markdown file with an upper-case extension beside a folder of its name is not a clash', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'guide.MD': '# Guide\n',
        'guide/setup.ts': '',
        'guide/usage.ts': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/file-folder-clashes')).toStrictEqual([]);
});
