import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each([false, true])('set validates the value before its reason: %s', async (hasReason) => {
    const settings = buildSandboxSettings(['structure']);
    await using sandbox = await testdir({ 'gspot.toml': settings });
    runGitStep(sandbox.path, ['init', '--quiet']);
    const result = await runGspot(sandbox.path, [
        'set',
        'limits.file_lines',
        'abc',
        ...(hasReason ? ['--reason', 'Generated files need more lines.'] : []),
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: 'The value abc is not valid for limits.file_lines. Use a whole number of 0 or more.',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
