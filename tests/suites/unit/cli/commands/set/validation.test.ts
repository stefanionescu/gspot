import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('set validates the value before its reason', async () => {
    const settings = buildSandboxSettings(['structure']);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const result = await runGspot(sandbox.path, [
        'set',
        'limits.max_file_lines',
        'abc',
        '--reason',
        'Generated files need more lines.',
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test.each(['set', 'unset'])('%s identifies a table and names its settings without writing', async (command) => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const result = await runGspot(sandbox.path, [command, 'hooks', ...(command === 'set' ? ['false'] : []), '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('hooks.enabled') as string,
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
