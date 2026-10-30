import { test } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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

test.each([...SET_VALUE_REFUSALS])(
    'set refuses $name without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await createGitSandbox(REFUSAL_FILES);
        await assertRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message });
    },
);
