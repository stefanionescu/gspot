import { test, expect } from 'bun:test';
import { readTree } from '#tests/setup/system/files.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

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

    await assertRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message: expected });
});

test.each([...UNKNOWN_SETTING_KEYS])(
    'set refuses the unknown or unavailable key $key and writes nothing',
    async ({ key, message }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['data-files']),
            'settings.toml': 'enabled = true\n',
        });

        await assertRefusalWithoutWrites(sandbox.path, ['set', key, '{ enabled = true }'], {
            error: 'arguments',
            message: `${message} Run gspot list settings to see every one.`,
        });
    },
);

test('set classifies malformed settings as a parse error', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'configurations = [' });
    const before = await readTree(sandbox.path);
    const failure = await runGspot(sandbox.path, ['set', 'level', 'all', '--json']);
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe('');
    expect(JSON.parse(failure.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'parse',
        message: 'gspot.toml:1:18 is not valid TOML: Expected "]". Fix the file.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...SET_VALUE_REFUSALS])(
    'set refuses $name in text and JSON without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await createGitSandbox(REFUSAL_FILES);
        await assertRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message });
    },
);
