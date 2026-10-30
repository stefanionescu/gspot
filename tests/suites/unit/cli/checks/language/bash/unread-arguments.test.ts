import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { UNREAD_ARGUMENT_CASES } from '#tests/config/checks/language/bash/bash.ts';

test('main "$@" with a main that reads no argument is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout')).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'bash/unread-arguments')).toStrictEqual([]);
});

test.each([...UNREAD_ARGUMENT_CASES])(
    'bash/unread-arguments reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'bash/unread-arguments', ...row };
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test('argument counts stay in their script and reach functions in sourced libraries', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'first.sh': '#!/usr/bin/env bash\n_show() { echo "$1"; }\n_show one two\n',
        'second.sh': '#!/usr/bin/env bash\n_show() { echo "$1"; }\n',
    });
    const found = await runSandboxCheck(sandbox.path, 'bash/unread-arguments');
    expect(found.map(({ file }) => file)).toStrictEqual(['first.sh']);
    await writeFile(join(sandbox.path, 'first.sh'), '#!/usr/bin/env bash\n. ./second.sh\n_show one two\n');
    const corrected = await runSandboxCheck(sandbox.path, 'bash/unread-arguments');
    expect(corrected.map(({ file }) => file)).toStrictEqual(['second.sh']);
});

test('a function that reads flags with getopts accepts its positional arguments', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': 'main() { while getopts "v" option; do printf "%s\\n" "$option"; done; }\nmain -v\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unread-arguments')).toStrictEqual([]);
});
