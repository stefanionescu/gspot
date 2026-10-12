import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';

test('add applies gspot.toml and installs no npm tools', async () => {
    const argv = ['add', 'bash', '--scope', 'api'];
    const settings = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = []
`;
    const configurations = ['bash'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'README.md': '# Example\n',
        'api/entry.sh': 'echo api\n',
    });
    commitAll(sandbox.path);
    const run = processes.run;
    const installations: string[][] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options, output) => {
            if (command[0] === 'npm' && command[1] !== '--version') installations.push([...command]);
            return run(command, options, output);
        }),
    );
    const result = await runGspot(sandbox.path, [...argv, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(installations).toStrictEqual([]);
    expect(result.stdout + result.stderr).toContain('Run: gspot install');
    const saved = readSettings(sandbox.path).settings;
    expect(saved.scope['api']!.configurations).toStrictEqual(configurations);
    expect(saved.configurations).toStrictEqual(['markdown']);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
});

test('add refuses an always-selected configuration before writing', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'source.py': 'PORT = 8080\n' });
    const before = await readTree(sandbox.path);
    for (const json of [false, true]) {
        const result = await runGspot(sandbox.path, ['add', 'security', ...(json ? ['--json'] : [])]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain('run gspot set level');
        if (json) expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
});
