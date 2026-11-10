import { expect, test } from 'bun:test';

import { MISE_INSTALL_URL } from '#cli/config/tools/programs.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { findMisePin, listDistinctTools } from '#cli/tools/pins.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeExecutableLookup, fakeNpmTool } from '#tests/setup/system/fakes.ts';

test('with no mise on PATH, doctor sends the tools that mise installs to mise, not to gspot install', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    const programs = listDistinctTools(session.toolConfigurations).filter(({ kind }) => kind === 'program');
    const installed = listHostCheckTools(session);
    const fromMise = programs
        .filter((tool) => findMisePin(tool) !== undefined && installed.has(tool.name))
        .map(({ name }) => name);
    const fromNpm = programs.filter(({ installers }) => installers['npm'] !== undefined);
    await Promise.all(fromNpm.map(({ name }) => fakeNpmTool(sandbox.path, name)));
    using _lookup = fakeExecutableLookup((name) => (name === 'mise' || fromMise.includes(name) ? null : undefined));
    const result = await runGspot(sandbox.path, ['doctor']);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
        `mise is not on PATH. Install mise (${MISE_INSTALL_URL}), or install these tools yourself: ${fromMise.join(', ')}.`,
    );
    expect(result.stdout).not.toContain('Run gspot install');
});
