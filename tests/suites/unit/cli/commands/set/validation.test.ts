import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { VALUE_VALIDATION_CASES } from '#tests/config/commands/set.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(VALUE_VALIDATION_CASES)('set validates the value before its reason: $name', async ({ hasReason }) => {
    const settings = buildSandboxSettings(['structure']);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const result = await runGspot(sandbox.path, [
        'set',
        'limits.file_lines',
        'abc',
        ...(hasReason ? ['--reason', 'Generated files need more lines.'] : []),
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: 'The value abc is not valid for limits.file_lines. Use a whole number of 0 or more.',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test.each(['set', 'unset'])('%s identifies a table and names its settings without writing', async (command) => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const result = await runGspot(sandbox.path, [command, 'hooks', ...(command === 'set' ? ['false'] : [])]);
    expect(result.code).toBe(2);
    expect(result.stderr).toStartWith('hooks is a table. Name one of its settings, such as hooks.enabled.');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
