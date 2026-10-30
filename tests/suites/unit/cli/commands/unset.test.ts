import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/toml.ts';
import { UNSET_REFUSALS } from '#tests/config/commands/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...UNSET_REFUSALS])(
    'unset $commandArguments exits 2 and leaves gspot.toml as it was',
    async ({ commandArguments, message }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
        const path = join(sandbox.path, 'gspot.toml');
        const before = await readFile(path, 'utf8');
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code).toBe(2);
        expect(result.stderr).toBe(`${message}\n`);
        expect(await readFile(path, 'utf8')).toBe(before);
    },
);

test('unset removes the scanner setting and keeps bunfig.toml', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const previous = await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8');
    const unset = await runGspot(sandbox.path, ['unset', 'dependencies.bun_scanner']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).not.toHaveProperty(
        'dependencies.bun_scanner',
    );
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
    const repeated = await runGspot(sandbox.path, ['apply']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
});
