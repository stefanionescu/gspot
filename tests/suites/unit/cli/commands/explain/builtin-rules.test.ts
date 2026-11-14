import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('explain reads built-in YAML rule fixes without an installed tool and rejects unknown rules', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['yaml']) });
    const explained = await runGspot(sandbox.path, ['explain', 'yaml/syntax', 'documents']);
    expect(explained.code, explained.stderr).toBe(0);
    expect(explained.stdout).toContain('What to do:');
    expect(explained.stdout).toContain('gspot ignore yaml/syntax --rule documents --paths');
    expect(explained.stdout).not.toContain('undefined');
    const refused = await runGspot(sandbox.path, ['explain', 'yaml/syntax', 'document', '--json']);
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

test('explain prints each word of the shipped lists that the banned-word rule reads', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const explained = await runGspot(sandbox.path, ['explain', 'naming/identifiers', 'banned-word']);
    expect(explained.code, explained.stderr).toBe(0);
    const { abbreviations, generic_verbs: verbs } = readNamingDefaults().lists;
    expect(explained.stdout).toContain(`abbreviations (${abbreviations!.words.join(', ')})`);
    expect(explained.stdout).toContain(
        `generic verbs as the first word of functions and methods (${verbs!.words.join(', ')})`,
    );
});
