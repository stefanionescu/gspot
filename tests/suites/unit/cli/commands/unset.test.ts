import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { UNSET_REFUSALS } from '#tests/config/commands/unset.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

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

test('unset leaves the Bun scanner in bunfig.toml after its setting goes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const previous = await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8');
    const unset = await runGspot(sandbox.path, ['unset', 'dependencies.bun_scanner']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
    const repeated = await runGspot(sandbox.path, ['apply']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(previous);
});
