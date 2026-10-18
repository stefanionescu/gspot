import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';

test.each(['add', 'remove'])('%s applies gspot.toml and installs no npm tools', async (command) => {
    await using sandbox = await testdir({
        'gspot.toml': `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ${JSON.stringify(command === 'add' ? [] : ['bash'])}
`,
        'README.md': '# Example\n',
        'api/entry.sh': 'echo api\n',
    });
    commitAll(sandbox.path);
    const initial = await runGspot(sandbox.path, ['apply']);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(
        command === 'remove',
    );
    const run = processes.spawnProcess;
    const installations: string[][] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] === 'npm' && command[1] !== '--version') installations.push([...command]);
            return run(command, options);
        }),
    );
    const result = await runGspot(sandbox.path, [command, 'bash', '--scope', 'api', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ changed: true });
    expect(installations).toStrictEqual([]);
    expect(result.stdout + result.stderr).toContain('Run: gspot install');
    const saved = readSettings(sandbox.path, createReadCache(process.cwd())).settings;
    expect(saved.scopes['api']!.configurations).toStrictEqual(command === 'add' ? ['bash'] : []);
    expect(saved.configurations).toStrictEqual(['markdown']);
    if (command === 'remove')
        expect((parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['scope']).toEqual([
            { path: 'api', removed_configurations: ['bash'] },
        ]);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(
        command === 'add',
    );
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
});

test.each([false, true].flatMap((json) => ['add', 'remove'].map((command) => ({ command, json }))))(
    'add refuses an always-selected configuration before writing (%j)',
    async ({ command, json }) => {
        await using sandbox = await testdir({
            'gspot.toml': 'configurations = []\n',
            'source.py': 'PORT = 8080\n',
        });
        const before = await readTree(sandbox.path);

        const result = await runGspot(sandbox.path, [command, 'security', ...(json ? ['--json'] : [])]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain('run gspot set level');
        if (json) expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments' });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test.each([
    [
        'a configuration another configuration requires',
        ['remove', 'javascript'],
        'Cannot remove `javascript`: typescript requires javascript. Remove `typescript` first, or keep `javascript`.',
        2,
    ],
    ['a configuration the selection does not list', ['remove', 'bash'], 'No change: bash is not selected.', 0],
    [
        'a configuration a scope does not list',
        ['remove', 'typescript', '--scope', 'api'],
        'No change: typescript is not selected.',
        0,
    ],
])(
    'removing %s preserves the settings and reports the prescribed outcome',
    async (_, commandArguments, expected, code) => {
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
        const refused = await runGspot(sandbox.path, commandArguments);
        expect(refused.code, refused.stdout + refused.stderr).toBe(code);
        expect(refused.stdout).toBe(code === 0 ? `${expected}\n` : '');
        expect(refused.stderr).toBe(code === 0 ? '' : `${expected}\n`);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(structured.code, structured.stdout + structured.stderr).toBe(code);
        expect(structured.stderr).toBe('');
        expect(JSON.parse(structured.stdout)).toStrictEqual(
            code === 0 ? { changed: false } : { error: 'arguments', message: expected },
        );
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);
