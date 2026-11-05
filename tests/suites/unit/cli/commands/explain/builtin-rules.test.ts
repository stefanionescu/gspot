import { expect, test } from 'bun:test';

import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('explain reads built-in YAML rule fixes without an installed tool and rejects unknown rules', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['data-files']) });
    const explained = await runGspot(sandbox.path, ['explain', 'data-files/yaml', 'documents']);
    expect(explained.code, explained.stderr).toBe(0);
    expect(explained.stdout).toContain('What to do:');
    expect(explained.stdout).toContain('gspot ignore data-files/yaml --rule documents --paths');
    expect(explained.stdout.indexOf('What to do:')).toBeLessThan(explained.stdout.indexOf('Ignore it'));
    expect(explained.stdout).not.toContain('undefined');
    const refused = await runGspot(sandbox.path, ['explain', 'data-files/yaml', 'document', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('document') as string,
    });
});

test('explain reads a documented rule of a check that compares generator outputs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['drizzle']) });
    const explained = await runGspot(sandbox.path, ['explain', 'drizzle/stale-migrations', 'stale']);
    expect(explained.code, explained.stderr).toBe(0);
    expect(explained.stdout).toContain('What to do:');
    expect(explained.stdout).toContain('gspot ignore drizzle/stale-migrations --rule stale --paths');
});
