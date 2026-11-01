import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import * as revisions from '#cli/engine/copies/revision.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a staged check of a clean tree runs in place, and an ignored file stays out of it', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\nignored.sh\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_CHECK }),
        'entry.sh': '#!/usr/bin/env bash\necho ready\n',
        'ignored.sh': BROKEN_IF_SCRIPT,
    });
    runGitStep(sandbox.path, ['add', '-A']);
    using copies = spyOn(revisions, 'copyRevision');
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/bash-syntax', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(copies).not.toHaveBeenCalled();
});

test('a staged check with an untracked file runs in a copy', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_CHECK }),
        'entry.sh': '#!/usr/bin/env bash\necho ready\n',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'notes.txt'), 'unstaged\n');
    using copies = spyOn(revisions, 'copyRevision');
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/bash-syntax', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(copies).toHaveBeenCalledTimes(1);
});
