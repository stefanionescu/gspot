import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { MANAGED_KEYS_NOTE } from '#cli/config/generation/files.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/setup/languages.ts';
import { settingsEditOutputSchema } from '#tests/schemas/setup.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('unset of an item of a setting that is not a list or a table exits 2, names the plain unset, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const failure = await assertRefusalWithoutWrites(sandbox.path, ['unset', 'level', 'extra'], 'arguments');
    expect(failure.message).toBe('level is not a list or a table, so it takes no items. Run gspot unset level.');
});

test('unset says when an empty list turns a check off', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }),
    });
    const unset = await runGspot(sandbox.path, ['unset', 'licenses.allowed', '--json']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(unset.stdout)).notes).toContain(
        'This turns off licenses/allowed.',
    );
});

test('unset configurations names the commands that change that list', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const failure = await assertRefusalWithoutWrites(sandbox.path, ['unset', 'configurations'], 'arguments');
    expect(failure.message).toContain('gspot add or gspot remove');
});

test('unset removes the scanner setting and keeps bunfig.toml', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    await applyGeneratedFiles(sandbox.path);
    const previous = await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8');
    const unset = await runGspot(sandbox.path, ['unset', 'dependencies.bun_scanner']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(unset.stdout).toContain(MANAGED_KEYS_NOTE);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(parse(settings)).not.toHaveProperty('dependencies.bun_scanner');
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
    await applyGeneratedFiles(sandbox.path);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
});

test('a settings edit while gspot manages the scanner adds no note about unmanaged keys', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: BUN_SCANNER_SETTINGS }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    await applyGeneratedFiles(sandbox.path);
    const result = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toContain(MANAGED_KEYS_NOTE);
});

test('a settings edit that leaves the scanner of the repository alone adds no note about unmanaged keys', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'bunfig.toml': '[install.security]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const result = await runGspot(sandbox.path, ['set', 'level', 'basic']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toContain(MANAGED_KEYS_NOTE);
});

test.each([
    ['naming.banned_words', '[naming]\nbanned_words = ["retained"]\n'],
    ['spelling.allowed_words', '[spelling.allowed_words]\nNebulix = "The product name keeps the vendor spelling."\n'],
])('unset identifies an absent item of %s without changing the settings', async (key, tables) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { tables }) });
    const path = join(sandbox.path, 'gspot.toml');
    const before = await readFile(path, 'utf8');
    const result = await runGspot(sandbox.path, ['unset', key, 'zzz', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        changed: false,
        summary: expect.stringContaining('zzz') as string,
    });
    expect(await readFile(path, 'utf8')).toBe(before);
});
