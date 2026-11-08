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

test('an unknown setting suggests the full key, which set takes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const refusal = await assertRefusalWithoutWrites(sandbox.path, ['set', 'format.print_wide', '100'], 'arguments');
    expect(refusal.message).toContain('Did you mean format.print_width?');
    const accepted = await runGspot(sandbox.path, ['set', 'format.print_width', '100']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a naming key of a category names the parent key that takes the value, before it asks for a reason', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['typescript']) });
    const refusal = await assertRefusalWithoutWrites(
        sandbox.path,
        ['set', 'naming.typescript.classes.cases', 'camel'],
        'arguments',
    );
    expect(refusal.message).toContain('gspot set naming.typescript.types.cases');
    expect(refusal.message).not.toContain('--reason');
    const accepted = await runGspot(sandbox.path, [
        'set',
        'naming.typescript.types.cases',
        'camel',
        '--reason',
        'the team writes camel types',
    ]);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test.each([...SET_VALUE_REFUSALS])('set refuses $name without writing', async ({ arguments: commandArguments }) => {
    await using sandbox = await createGitSandbox(REFUSAL_FILES);
    await assertRefusalWithoutWrites(sandbox.path, commandArguments, 'arguments');
});

test.each([{ key: 'level', value: 'all', ignore: '--rule level' }])(
    'set refuses --reason on $key, and names the ignore that records it',
    async ({ key, value, ignore }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
        const refusal = await assertRefusalWithoutWrites(
            sandbox.path,
            ['set', key, value, '--reason', 'the team chose this'],
            'arguments',
        );
        expect(refusal.message).toContain(`gspot ignore gspot/weakenings ${ignore}`);
    },
);
