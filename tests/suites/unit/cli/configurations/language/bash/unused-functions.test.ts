import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    TRAP_SCRIPT_FORMS,
    TRAP_FUNCTION_SOURCE,
    UNUSED_FUNCTION_CASES,
    LITERAL_FUNCTION_REFERENCES,
} from '#tests/config/configurations/bash.ts';

test.each(TRAP_SCRIPT_FORMS)('a function called by trap %s is not reported', async (script) => {
    await using sandbox = await createGitSandbox({
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'test.bats':
            '#!/usr/bin/env bats\nsetup() { echo ready; }\nteardown() { echo done; }\nsetup_file() { echo ready; }\nteardown_file() { echo done; }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test('a call from any script in the scope counts, without a source line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'helpers/aliases.sh': '#!/usr/bin/env bash\n_create_aliases() { printf ready; }\n_unused() { printf idle; }\n',
        'setup.d/postfix.sh': '#!/usr/bin/env bash\n_create_aliases\n',
        'test/helper/common.bash': '#!/usr/bin/env bash\n_start_server() { printf ready; }\n',
        'test/server.bats': '#!/usr/bin/env bats\nload helper/common\n\n@test "starts" {\n  _start_server\n}\n',
    });
    const found = await runSandboxCheck(sandbox.path, 'bash/unused-functions');
    expect(found.map(({ file, message }) => ({ file, message }))).toStrictEqual([
        { file: 'helpers/aliases.sh', message: 'No script in this scope calls _unused. Delete it, or call it.' },
    ]);
    await writeFile(join(sandbox.path, 'setup.d/postfix.sh'), '#!/usr/bin/env bash\n_create_aliases\n_unused\n');
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});

test.each(LITERAL_FUNCTION_REFERENCES)('literal function argument %s counts as a reference', async (command) => {
    const name = command.endsWith('_download') ? '_download' : '_each';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${name}() { printf ready; }\n${command}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/unused-functions')).toStrictEqual([]);
});
