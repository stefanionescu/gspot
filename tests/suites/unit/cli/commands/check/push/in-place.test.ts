import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import * as revisions from '#cli/engine/copies/revision.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/commands/check.ts';
import { BASH_SYNTAX_PUSH_CHECK } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    ['runs in place on a clean tree', false, 0],
    ['checks the pushed commit in a copy while the index holds a staged change', true, 1],
])('a push of HEAD %s', async (_scenario, isStaged, copies) => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_PUSH_CHECK }),
        'entry.sh': 'echo base\n',
    });
    const base = commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'entry.sh'), 'echo pushed\n');
    const head = commitAll(sandbox.path, 'pushed');
    if (isStaged) {
        await writeFile(join(sandbox.path, 'entry.sh'), BROKEN_IF_SCRIPT);
        runGitStep(sandbox.path, ['add', 'entry.sh']);
    }
    using copied = spyOn(revisions, 'copyRevision');
    const stdin = `refs/heads/main ${head} refs/heads/main ${base}\n`;
    const result = await runGspot(sandbox.path, PUSH_CHECK_COMMAND, {}, { stdin });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(copied).toHaveBeenCalledTimes(copies);
});
