import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import * as revisions from '#cli/engine/copies/revision.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { BASH_SYNTAX_PUSH_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

async function commitPushInput(root: string): Promise<string> {
    const base = commitAll(root);
    await writeFile(join(root, 'entry.sh'), 'echo pushed\n');
    const head = commitAll(root, 'pushed');
    return `refs/heads/main ${head} refs/heads/main ${base}\n`;
}

test('a push of a clean HEAD passes in a folder without a lockfile', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'package.json': '{"name":"example","private":true}\n',
        'node_modules/dependency/index.js': 'export const isPassing = true;\n',
        'entry.sh': 'echo base\n',
    });
    const stdin = await commitPushInput(sandbox.path);
    const result = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, { stdin });
    expect(result.code, result.stdout + result.stderr).toBe(0);
});

test('a push of HEAD checks the pushed commit in a copy while the index holds a staged change', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'entry.sh': 'echo base\n',
    });
    const stdin = await commitPushInput(sandbox.path);
    await writeFile(join(sandbox.path, 'entry.sh'), BROKEN_IF_SCRIPT);
    runGitStep(sandbox.path, ['add', 'entry.sh']);
    using copied = spyOn(revisions, 'copyRevision');
    const result = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, { stdin });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(copied).toHaveBeenCalledTimes(1);
});
