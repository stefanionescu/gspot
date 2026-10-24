import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

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
