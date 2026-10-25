import { test, expect } from 'bun:test';
import { readTree } from '#tests/setup/system/files.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, expectRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

import {
    SET_REFUSALS,
    SET_SETTINGS,
    REFUSAL_FILES,
    SET_VALUE_REFUSALS,
    UNKNOWN_SETTING_KEYS,
} from '#tests/config/commands/set.ts';

test.each([...SET_REFUSALS])('set refuses %s', async (_, commandArguments, expected) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': SET_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });

    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${expected}\n`);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'arguments', message: expected });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...UNKNOWN_SETTING_KEYS])(
    'set refuses the unknown or unavailable key $key and writes nothing',
    async ({ key, message }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['data-files']),
            'settings.toml': 'enabled = true\n',
        });

        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, '{ enabled = true }']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toBe(`${message} Run \`gspot list settings\` to see every one.\n`);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('set leaves existing malformed settings classified as settings errors', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'configurations = [' });
    const before = await readTree(sandbox.path);
    const failure = await runGspot(sandbox.path, ['set', 'level', 'all', '--json']);
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe('');
    expect(JSON.parse(failure.stdout)).toStrictEqual({
        error: 'settings',
        message: 'gspot.toml:1:18 is not valid TOML: Expected "]"',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...SET_VALUE_REFUSALS])(
    'set refuses $name in text and JSON without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await createGitSandbox(REFUSAL_FILES);
        await expectRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message });
    },
);
