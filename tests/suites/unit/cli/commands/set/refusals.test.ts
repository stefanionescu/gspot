import { expect, test } from 'bun:test';

import { REFUSAL_FILES } from '#tests/config/commands/edits.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { key: 'ignore', value: 'bash/shellcheck', named: 'gspot ignore' },
    { key: 'command_check', value: 'lint', named: '[[command_check]]' },
])('set refuses the record list $key and names where it goes', async ({ key, value, named }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const failure = await assertRefusalWithoutWrites(sandbox.path, ['set', key, value], 'arguments');
    expect(failure.message).toContain(named);
});

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

test('set refuses a rule that the installed catalog does not hold and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'guide.md': '# Guide\n',
        '.gspot/node_modules/markdownlint/package.json': '{"exports":"./lib/exports.mjs"}',
        '.gspot/node_modules/markdownlint/lib/exports.mjs': 'throw new Error("Package code must not run");',
        '.gspot/node_modules/markdownlint/schema/markdownlint-config-schema.json': JSON.stringify({
            properties: { MD026: { description: 'MD026/no-trailing-punctuation : Punctuation : https://example.com' } },
        }),
    });
    const failure = await assertRefusalWithoutWrites(
        sandbox.path,
        ['set', 'tools.markdownlint.rules', '{ MD999 = { punctuation = "." } }'],
        'arguments',
    );
    expect(failure.message).toBe('gspot does not know rule MD999 of markdown/markdownlint.');
});

test('set of a rule whose catalog is not installed names the install, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'guide.md': '# Guide\n',
    });
    const failure = await assertRefusalWithoutWrites(
        sandbox.path,
        ['set', 'tools.markdownlint.rules', '{ MD026 = { punctuation = "." } }'],
        'tool',
    );
    expect(failure.message).toBe('Markdownlint is not installed. Run gspot install.');
});

test.each([
    {
        name: 'a scope that no record declares',
        commandArguments: ['set', 'limits.max_file_lines', '100', '--scope', 'web'],
        message: 'There is no scope called web. Name a folder that has a [[scope]] record or holds a project file.',
    },
    {
        name: 'malformed TOML',
        commandArguments: ['set', 'ci.setup_command', '['],
        message:
            'The value [ is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.',
    },
    {
        name: 'a list item without the reason of the list',
        commandArguments: ['set', 'site.allowed_unlisted_pages', 'admin/index.html'],
        message:
            'site.allowed_unlisted_pages already has the reason "The private page belongs outside the public site map.". Pass --reason with a reason that covers every item.',
    },
])('set refuses $name, names the fix, and writes nothing', async ({ commandArguments, message }) => {
    await using sandbox = await createGitSandbox(REFUSAL_FILES);
    const failure = await assertRefusalWithoutWrites(sandbox.path, commandArguments, 'arguments');
    expect(failure.message).toBe(message);
});

test.each([
    { key: 'level', value: 'all', fix: ', then gspot ignore gspot/weakenings --rule level --reason "<why>"' },
    { key: 'hooks.enabled', value: 'false', fix: ', then gspot ignore gspot/weakenings --rule hooks --reason "<why>"' },
    { key: 'spelling.locale', value: 'en-gb', fix: '' },
])(
    'set refuses --reason on $key, which holds no reason, and names the ignore that records it',
    async ({ key, value, fix }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
        const failure = await assertRefusalWithoutWrites(
            sandbox.path,
            ['set', key, value, '--reason', 'the team chose this'],
            'arguments',
        );
        expect(failure.message).toBe(`${key} holds no reason. Run the command without --reason${fix}.`);
    },
);

test('set identifies a table and names its settings without writing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', 'hooks', 'false', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('hooks.enabled') as string,
    });
});
