import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('setting level all and unsetting it restores every generated file and its bytes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'python']),
        'main.ts': 'export const port = 8080;\n',
        'main.py': 'PORT = 8080\n',
        'README.md': '# Example\n',
    });
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    const before = await readTree(sandbox.path);
    const all = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/general/prose/vale.ini'))).toBe(true);
    expect(await readTree(sandbox.path)).not.toStrictEqual(before);
    const restored = await runGspot(sandbox.path, ['unset', 'level']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
