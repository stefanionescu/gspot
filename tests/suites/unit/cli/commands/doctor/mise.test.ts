import { expect, test } from 'bun:test';

import { MISE_INSTALL_URL } from '#cli/config/tools/programs.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

test('with no mise on PATH, doctor names mise and the tools that mise installs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    using _lookup = fakeExecutableLookup(null);
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.code).toBe(1);
    const prefix = `mise is not on PATH. Install mise (${MISE_INSTALL_URL}), or install these tools yourself: `;
    const line = result.stdout.split('\n').find((each) => each.startsWith(prefix));
    expect(line?.slice(prefix.length, -1).split(', ')).toContain('taplo');
});
