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
    SCRIPT_LAYOUT_CASES,
    ENVIRONMENT_READER_SCOPE_TABLES,
} from '#tests/config/checks/language/bash/script-layout.ts';

test('an environment reader that only its scope declares may run top-level commands', async () => {
    await using sandbox = await testdir({
        'tools/env.sh': '#!/usr/bin/env bash\nload_environment\n',
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', tables: ENVIRONMENT_READER_SCOPE_TABLES }),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});

test.each([...SCRIPT_LAYOUT_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test('library declarations span array and heredoc lines without creating flow findings', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'library.sh': '#!/usr/bin/env bash\nvalues=(\n  first\n  second\n)\ntext=$(cat <<EOF\nmessage\nEOF\n)\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'library.sh'), '#!/usr/bin/env bash\necho ready\n');
    const found = await runSandboxCheck(sandbox.path, 'bash/script-layout');
    expect(found.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'library-flow', line: 2 }]);
});

test('Bash layout skips Bats tests, Zsh files and Korn shell shebangs', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.bats': '@test "ready" {\n  true\n}\n',
        'sample.zsh': 'print ready\n',
        'sample.sh': '#!/usr/bin/env ksh\nprint ready\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/script-layout')).toStrictEqual([]);
});
