import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import type { CommandFailureJson } from '#cli/types/system.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a pre-push check in a shallow clone refuses commits/commitlint-pushed and names git fetch --unshallow', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    await createFileTree(source, {
        'gspot.toml': buildSandboxSettings(['bash', 'commits'], { tables: BASH_SYNTAX_CHECK, level: 'all' }),
        'source.sh': 'echo base\n',
    });
    runGitStep(source, ['init', '-q']);
    await applyGeneratedFiles(source);
    runGitStep(source, ['add', '-A']);
    runGitStep(source, ['commit', '-qm', 'chore: initialize']);
    await writeFile(join(source, 'source.sh'), 'echo selected\n');
    runGitStep(source, ['commit', '-qam', 'feat: select source']);
    const selected = runGitStep(source, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const checkout = join(sandbox.path, 'checkout');
    const command = ['check', '--hook', 'pre-push', '--json', '--only', 'commits/commitlint-pushed'];
    const remote = ['--', 'unseen', 'unused'];
    const input = { stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(selected.length)}\n` };
    runGitStep(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    const refused = await runGspot(checkout, [...command, ...remote], {}, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const { message } = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(message).toContain('commits/commitlint-pushed');
    expect(message).toContain('git fetch --unshallow');
});
