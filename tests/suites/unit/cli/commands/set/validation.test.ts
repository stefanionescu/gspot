import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
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
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'arguments',
        message: 'The value abc is not valid for limits.file_lines. Use a whole number of 0 or more.',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('set refuses a boolean setting that is not true or false and names both values', async () => {
    const settings = buildSandboxSettings([]);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const result = await runGspot(sandbox.path, ['set', 'hooks.enabled', 'maybe', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'arguments',
        message: 'The value maybe is not valid for hooks.enabled. Use true or false.',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
