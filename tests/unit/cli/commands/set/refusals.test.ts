import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { SET_SETTINGS, TAPLO_REASON } from '#tests/config/set.ts';

test.each([
    [
        'a scope-only key without --scope',
        ['set', 'tools.shellcheck.extra', '{ external_sources = true }'],
        '--scope api',
    ],
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'gspot ignore markdown/markdownlint --rule <rule> --reason',
    ],
    ['a key without a value', ['set', 'limits.file_lines'], "missing required argument 'values'"],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'gspot.toml has no [[scope]] with path = "web". Add one, or leave out --scope.',
    ],
])('set refuses %s', async (_, argv, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SET_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain(expected);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(SET_SETTINGS);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe(argv[1] === 'tools.markdownlint.rules' ? 'settings' : 'arguments');
    expect(failure.message).toContain(expected);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(['tools.taplo.unknown', 'tools.eslint.extra', 'tools.v8r.extra'])(
    'set refuses the unknown or unavailable key %s and writes nothing',
    async (key) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['files']),
            'settings.toml': 'enabled = true\n',
        });
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, '{ enabled = true }', '--reason', TAPLO_REASON]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain(key);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('an invalid level leaves gspot.toml as it was', async () => {
    await using sandbox = await testdir();
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const settings = settingsText(['bash', 'naming']);
    await Bun.write(settingsPath, settings);
    const refused = await runGspot(sandbox.path, ['set', 'level', 'strict']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Invalid option: expected one of');
    expect(refused.stdout + refused.stderr).toContain('recommended');
    expect(refused.stdout + refused.stderr).toContain('all');
    expect(await Bun.file(settingsPath).text()).toBe(settings);
});
