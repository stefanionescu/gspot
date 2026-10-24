import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { readSettings } from '#cli/settings/read.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/apply/files/generated.ts';

test.each(['api', './api'])('settings commands resolve scope %s from the calling folder', async (scope) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'packages/api', configurations: [] }] }),
        'packages/api/run.sh': 'printf "example\\n"\n',
    });
    const cwd = join(sandbox.path, 'packages');
    const added = await runGspot(cwd, ['add', 'bash', '--scope', scope]);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.scopes['packages/api']?.configurations).toStrictEqual(['bash']);
    const set = await runGspot(cwd, ['set', 'limits.function_lines', '30', '--scope', scope]);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.scopes['packages/api']?.limits?.function_lines).toBe(30);
    const unset = await runGspot(cwd, ['unset', 'limits.function_lines', '--scope', scope]);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.scopes['packages/api']?.limits?.function_lines).toBeUndefined();
    const removed = await runGspot(cwd, [
        'remove',
        'bash',
        '--scope',
        scope,
        '--reason',
        'The scope no longer contains shell scripts.',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.scopes['packages/api']?.configurations).toStrictEqual([]);
    expect(readSettings(sandbox.path).settings.scopes['packages/api']?.removed_configurations).toStrictEqual(['bash']);
});

test('apply prints no managed-key warning while it still manages the Bun scanner', async () => {
    await using sandbox = await testdir({
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

test('unset warns when the Bun scanner remains after its setting goes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n',
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const original = await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8');
    const unset = await runGspot(sandbox.path, ['unset', 'dependencies.bun_scanner', '--json']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect((JSON.parse(unset.stdout) as ApplyReport).notes).toContain(MANAGED_KEYS_NOTE);
    expect(await readFile(join(sandbox.path, 'bunfig.toml'), 'utf8')).toBe(original);
    const repeated = await runGspot(sandbox.path, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyReport).notes).not.toContain(MANAGED_KEYS_NOTE);
});
