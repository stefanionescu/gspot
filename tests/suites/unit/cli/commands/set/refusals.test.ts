import { test } from 'bun:test';

import {
    REFUSAL_FILES,
    SET_REFUSALS,
    SET_SETTINGS,
    SET_VALUE_REFUSALS,
    UNKNOWN_SETTING_KEYS,
} from '#tests/config/commands/edits.ts';
import { assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...SET_REFUSALS])('set refuses %s', async (_, commandArguments) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': SET_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });

    await assertRefusalWithoutWrites(sandbox.path, commandArguments, 'arguments');
});

test.each([...UNKNOWN_SETTING_KEYS])(
    'set refuses the unknown or unavailable key $key and writes nothing',
    async ({ key }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['data-files']),
            'settings.toml': 'enabled = true\n',
        });

        await assertRefusalWithoutWrites(sandbox.path, ['set', key, '{ enabled = true }'], 'arguments');
    },
);

test.each([...SET_VALUE_REFUSALS])('set refuses $name without writing', async ({ arguments: commandArguments }) => {
    await using sandbox = await createGitSandbox(REFUSAL_FILES);
    await assertRefusalWithoutWrites(sandbox.path, commandArguments, 'arguments');
});
