import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/toml.ts';
import { MANAGED_KEYS_NOTE } from '#tests/config/messages.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('apply prints no managed-key warning while it still manages the Bun scanner', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    for (const pass of [1, 2]) {
        const result = await runGspot(sandbox.path, ['apply', '--json']);
        expect(result.code, `pass ${String(pass)}: ${result.stdout}${result.stderr}`).toBe(0);
        expect((JSON.parse(result.stdout) as ApplyReport).notes).not.toContain(MANAGED_KEYS_NOTE);
    }
});

test('an unchanged settings edit that writes generated files does not say No change', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'level = "basic"\n' + buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', 'level', 'basic']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toStartWith('gspot.toml already says this.\n');
    expect(result.stdout).toContain('wrote ');
    expect(result.stdout).not.toContain('No change:');
});
