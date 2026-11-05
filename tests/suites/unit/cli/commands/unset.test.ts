import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { UNSET_REFUSALS } from '#tests/config/commands/edits.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/setup/languages.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...UNSET_REFUSALS])(
    'unset $commandArguments exits 2 and leaves gspot.toml as it was',
    async ({ commandArguments }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
        const path = join(sandbox.path, 'gspot.toml');
        const before = await readFile(path, 'utf8');
        const result = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(result.code).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
        expect(await readFile(path, 'utf8')).toBe(before);
    },
);

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
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(parse(settings)).not.toHaveProperty('dependencies.bun_scanner');
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
    await applyGeneratedFiles(sandbox.path);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
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
