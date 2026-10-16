import { join } from 'node:path';
import { parse } from 'smol-toml';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';

test.each([
    [
        'a configuration another configuration requires',
        ['remove', 'javascript'],
        'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
        2,
    ],
    ['a configuration the selection does not list', ['remove', 'bash'], 'nothing to remove', 0],
    ['a configuration a scope does not list', ['remove', 'typescript', '--scope', 'api'], 'nothing to remove', 0],
])('removing %s preserves the settings and reports the prescribed outcome', async (_, argv, expected, code) => {
    await using sandbox = await testdir();
    const settings = `configurations = ["typescript"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(code);
    expect(refused.stdout).toBe(code === 0 ? `${expected}\n` : '');
    expect(refused.stderr).toBe(code === 0 ? '' : `${expected}\n`);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(code);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual(
        code === 0 ? { changed: false } : { error: 'arguments', message: expected },
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('remove refuses an always-selected configuration before writing', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'source.py': 'PORT = 8080\n' });
    const before = await readTree(sandbox.path);
    for (const json of [false, true]) {
        const result = await runGspot(sandbox.path, ['remove', 'security', ...(json ? ['--json'] : [])]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain('run gspot set level');
        if (json) expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
});

test('remove applies gspot.toml and installs no npm tools', async () => {
    const argv = ['remove', 'bash', '--scope', 'api'];
    const settings = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;
    const configurations: string[] = [];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'README.md': '# Example\n',
        'api/entry.sh': 'echo api\n',
    });
    commitAll(sandbox.path);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gspot/config/api/shellcheckrc'))).toBe(true);
    const run = processes.spawnProcess;
    const installations: string[][] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] === 'npm' && command[1] !== '--version') installations.push([...command]);
            return run(command, options);
        }),
    );
    const result = await runGspot(sandbox.path, [...argv, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(installations).toStrictEqual([]);
    expect(result.stdout + result.stderr).toContain('Run: gspot install');
    const saved = readSettings(sandbox.path, createReadCache(process.cwd())).settings;
    expect(saved.scope['api']!.configurations).toStrictEqual(configurations);
    expect(saved.configurations).toStrictEqual(['markdown']);
    expect(await pathExists(join(sandbox.path, '.gspot/config/api/shellcheckrc'))).toBe(false);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))['scope']).toEqual([
        { path: 'api', removed_configurations: ['bash'] },
    ]);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
});
