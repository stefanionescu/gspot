import { expect, test } from 'bun:test';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a staged check of a clean tree passes in a folder without a lockfile', async () => {
    await using sandbox = await createGitSandbox({
        '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
        'gspot.toml': buildSandboxSettings([], { tables: BASH_SYNTAX_CHECK }),
        'package.json': '{"name":"example","private":true}\n',
        'node_modules/dependency/index.js': 'export const isPassing = true;\n',
        'entry.sh': '#!/usr/bin/env bash\necho ready\n',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/bash-syntax', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
});
