import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    TRAP_SCRIPT_FORMS,
    TRAP_FUNCTION_SOURCE,
    UNUSED_FUNCTION_CASES,
    LITERAL_FUNCTION_REFERENCES,
} from '#tests/config/checks/language/bash/bash.ts';

test.each(TRAP_SCRIPT_FORMS)('a function called by trap %s is not reported', async (script) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': TRAP_FUNCTION_SOURCE.replace('trap _cleanup EXIT', () => `trap ${script} EXIT`),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each([...UNUSED_FUNCTION_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test('Bats lifecycle hooks are called by the runner', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'test.bats':
            '#!/usr/bin/env bats\nsetup() { echo ready; }\nteardown() { echo done; }\nsetup_file() { echo ready; }\nteardown_file() { echo done; }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test('a function call stays in its own script until the caller sources a library', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'first.sh': '#!/usr/bin/env bash\n_show() { echo first; }\n_show\n',
        'second.sh': '#!/usr/bin/env bash\n_show() { echo second; }\n',
    });
    const found = await runSandboxCheck(sandbox.path, 'bash/unused-functions');
    expect(found.map(({ file }) => file)).toStrictEqual(['second.sh']);
    await writeFile(join(sandbox.path, 'first.sh'), '#!/usr/bin/env bash\nsource ./second.sh\n_show\n');
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each(LITERAL_FUNCTION_REFERENCES)('literal function argument %s counts as a reference', async (command) => {
    const name = command.endsWith('_download') ? '_download' : '_each';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${name}() { printf ready; }\n${command}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});
