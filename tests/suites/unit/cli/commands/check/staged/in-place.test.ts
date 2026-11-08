import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test('a staged check runs in place when only other files have untracked or unstaged work', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_CHECK }),
        'entry.sh': 'echo base\n',
        'other.sh': 'echo other\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo staged\n');
    runGitStep(sandbox.path, ['add', 'entry.sh']);
    await writeFile(join(sandbox.path, 'other.sh'), BROKEN_IF_SCRIPT);
    await writeFile(join(sandbox.path, 'untracked.sh'), BROKEN_IF_SCRIPT);
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/bash-syntax', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
});
