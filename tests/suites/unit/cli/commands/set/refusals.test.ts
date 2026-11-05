import { expect, test } from 'bun:test';

import {
    REFUSAL_FILES,
    SET_REFUSALS,
    SET_SETTINGS,
    SET_VALUE_REFUSALS,
    UNKNOWN_SETTING_KEYS,
} from '#tests/config/commands/edits.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
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

test.each([
    { key: 'ignore', value: 'bash/shellcheck', named: 'gspot ignore' },
    { key: 'command_check', value: 'lint', named: '[[command_check]]' },
])('set refuses the record list $key and names where it goes', async ({ key, value, named }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const failure = await assertRefusalWithoutWrites(sandbox.path, ['set', key, value], 'arguments');
    expect(failure.message).toContain(named);
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

test.each([
    { key: 'level', value: 'all', ignore: '--rule level' },
    { key: 'hooks.enabled', value: 'false', ignore: '--rule hooks' },
    { key: 'rule_files.enabled', value: 'false', ignore: '--rule rule-files' },
])('set refuses --reason on $key, and names the ignore that records it', async ({ key, value, ignore }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const refusal = await assertRefusalWithoutWrites(
        sandbox.path,
        ['set', key, value, '--reason', 'the team chose this'],
        'arguments',
    );
    expect(refusal.message).toContain(`gspot ignore gspot/weakenings ${ignore}`);
});

test('a reason on a value that is not weaker stays, and gspot.toml still reads', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'README.md': '# Example\n',
    });
    const result = await runGspot(sandbox.path, [
        'set',
        'limits.max_file_lines',
        '100',
        '--reason',
        'the team keeps files short',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const read = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(read.code, read.stdout + read.stderr).toBe(0);
});
