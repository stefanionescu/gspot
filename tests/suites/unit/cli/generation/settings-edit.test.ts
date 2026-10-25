import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation/write.ts';
import { readSandboxSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each(['api', './api'])('settings commands resolve scope %s from the calling folder', async (scope) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/api', configurations: [] }] }),
        'packages/api/run.sh': 'printf "example\\n"\n',
    });
    const cwd = join(sandbox.path, 'packages');
    const added = await runGspot(cwd, ['add', 'bash', '--scope', scope]);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(readSandboxSettings(sandbox.path).scopes['packages/api']?.configurations).toStrictEqual(['bash']);
    const set = await runGspot(cwd, ['set', 'limits.function_lines', '30', '--scope', scope]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(readSandboxSettings(sandbox.path).scopes['packages/api']?.limits?.function_lines).toBe(30);
    const unset = await runGspot(cwd, ['unset', 'limits.function_lines', '--scope', scope]);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(readSandboxSettings(sandbox.path).scopes['packages/api']?.limits?.function_lines).toBeUndefined();
    const removed = await runGspot(cwd, [
        'remove',
        'bash',
        '--scope',
        scope,
        '--reason',
        'The scope no longer contains shell scripts.',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readSandboxSettings(sandbox.path).scopes['packages/api']?.configurations).toStrictEqual([]);
    expect(readSandboxSettings(sandbox.path).scopes['packages/api']?.removed_configurations).toStrictEqual(['bash']);
});

test('apply prints no managed-key warning while it still manages the Bun scanner', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    for (const pass of [1, 2]) {
        const result = await runGspot(sandbox.path, ['apply', '--json']);
        expect(result.code, `pass ${String(pass)}: ${result.stdout}${result.stderr}`).toBe(0);
        expect((JSON.parse(result.stdout) as ApplyReport).notes).not.toContain(MANAGED_KEYS_NOTE);
    }
});
