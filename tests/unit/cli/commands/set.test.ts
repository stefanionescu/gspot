import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/values.ts';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { commitAll, readGitOutput, prepareAppliedBashRepository } from '#tests/setup/git.ts';
import { SET_SETTINGS, SCOPE_BANNED_WORDS, RESTRICTED_IMPORTS, BANNED_WORD_SCOPES } from '#tests/data/commands/set.ts';

test.each([
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'gspot.toml: tools.markdownlint.rules.MD013: This table holds options only, without a severity; the level decides which rules run. To turn MD013 off, run gspot ignore markdown/markdownlint --rule MD013 --reason "<why>".',
    ],
    ['a key without a value', ['set', 'limits.file_lines'], "Missing required argument 'values'"],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'gspot.toml has no [[scope]] with path = "web". Add one, or leave out --scope.',
    ],
    [
        'an invalid level',
        ['set', 'level', 'everything'],
        'The value `everything` is not valid for level. Use recommended or all.',
    ],
])('set refuses %s', async (_, commandArguments, expected) => {
    await using sandbox = await testdir({
        'gspot.toml': SET_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });

    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain(expected);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(SET_SETTINGS);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe('arguments');
    expect(failure.message).toContain(expected);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(['tools.eslint.extra', 'tools.v8r.extra'])(
    'set refuses the unknown or unavailable key %s and writes nothing',
    async (key) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['files']),
            'settings.toml': 'enabled = true\n',
        });

        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, '{ enabled = true }']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain(key);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('set and unset change a setting of a configuration that the files select', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{ "name": "example", "private": true }\n',
    });
    const set = await runGspot(sandbox.path, ['set', 'licenses.allowed', 'MIT']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(getValueAt(written, ['licenses', 'allowed'])).toEqual(['MIT']);
    const unset = await runGspot(sandbox.path, ['unset', 'licenses.allowed']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
});

test('set names -- when a value reads as an option, and takes the values after --', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const refused = await runGspot(sandbox.path, ['set', 'ci.setup_command', 'bun', 'install', '--frozen-lockfile']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(
        "Unknown option '--frozen-lockfile'. To pass a value that starts with -, put -- before the values: gspot set ci.setup_command -- bun install --frozen-lockfile.",
    );
    const set = await runGspot(sandbox.path, ['set', 'ci.setup_command', '--', 'bun', 'install', '--frozen-lockfile']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(set.stdout).not.toContain('(was undefined');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(getValueAt(written, ['ci', 'setup_command'])).toEqual(['bun', 'install', '--frozen-lockfile']);
});

test.each([
    ['unset level', ['unset', 'level']],
    ['set level recommended', ['set', 'level', 'recommended']],
])('%s reports no change when gspot.toml already has the value', async (_name, commandArguments) => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('No change: gspot.toml already has this value.');
});

test.each([
    [
        'set',
        ['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits.bash]\nfile_lines = { value = 200, reason = "Generated scripts need this limit." }',
    ],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
    ],
])('%s keeps its change in gspot.toml and exits 2 when apply then stops', async (_, commandArguments, written) => {
    await using sandbox = await testdir({
        'gspot.toml': `configurations = ["bash", "structure"]
[rules]
enabled = false
`,
        'entry.sh': 'echo example\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.editorconfig');
    await chmod(generated, 0o644);
    await writeFile(generated, 'root = true\n');
    const stopped = await runGspot(sandbox.path, commandArguments);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
    expect(stopped.stdout).toBe('');
    expect(stopped.stderr).toContain('gspot.toml keeps this change');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
});

test.each([...BANNED_WORD_SCOPES])(
    'set writes naming.banned_words in the $name scope without installing tools, and unset removes them',
    async ({ scope }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['naming', 'typescript'], { scopes: [{ path: 'app' }] }),
            'app/source.ts': 'export const active = true;\n',
        });
        const key = 'naming.banned_words';
        const scopeArguments = scope === '' ? [] : ['--scope', scope];
        const written = await runGspot(sandbox.path, ['set', key, ...SCOPE_BANNED_WORDS, ...scopeArguments]);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const settings = readSettings(sandbox.path).settings;
        const table = scope === '' ? settings.written : settings.scopes[scope]?.written;
        expect(getValueAt(table, ['naming', 'banned_words'])).toStrictEqual([...SCOPE_BANNED_WORDS]);
        expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const reset = await runGspot(sandbox.path, ['unset', key, ...scopeArguments]);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const next = readSettings(sandbox.path).settings;
        const nextTable = scope === '' ? next.written : next.scopes[scope]?.written;
        expect(getValueAt(nextTable, ['naming', 'banned_words'])).toBeUndefined();
        expect(await readFile(join(sandbox.path, 'app/source.ts'), 'utf8')).toBe('export const active = true;\n');
    },
);

test('gspot set writes a list of tables typed the TOML way as tables, and the settings refuses quoted ones', async () => {
    await using sandbox = await testdir({
        'README.md': '# test\n',
        'gspot.toml': buildSandboxSettings(['docs', 'javascript']),
    });

    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', RESTRICTED_IMPORTS]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(settings).toContain('name = "unreviewed-module"');
    expect(settings).not.toContain('"[{name');
    const unreadable = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', '[{name = ']);
    expect(unreadable.code).toBe(2);
    expect(unreadable.stdout + unreadable.stderr).toContain('is not a TOML inline value');
    // A person can still type the quotes by hand; gspot refuses those settings when it loads them.
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['docs', 'javascript'], {
            tables: `[tools.eslint]\nrestricted_imports = ['{name = "a", message = "Use its public entrypoint."}']\n`,
        }),
    );
    const read = await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(read.code, read.stdout + read.stderr).toBe(2);
    expect(JSON.parse(read.stdout) as CommandFailureJson).toStrictEqual({
        error: 'settings',
        message: 'gspot.toml: tools.eslint.restricted_imports.0: Invalid input: expected object, received string',
    });
});

test('set level all works in a fresh clone', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await prepareAppliedBashRepository(source);
    readGitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    const changed = await runGspot(checkout, ['set', 'level', 'all']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(readSettings(checkout).settings.level).toBe('all');
});

test.each([
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    { commandArguments: ['unset', 'no_such_key'], message: 'no_such_key' },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list or a table, so it takes no items. Run gspot unset level.',
    },
])('gspot $commandArguments refuses the change and preserves gspot.toml', async ({ commandArguments, message }) => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const path = join(sandbox.path, 'gspot.toml');
    const before = await readFile(path, 'utf8');
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(message);
    expect(await readFile(path, 'utf8')).toBe(before);
});

test('set reports a structured-value parser failure as an argument error', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const before = await readTree(sandbox.path);
    const failure = await runGspot(sandbox.path, ['set', 'ci.setup_command', '[', '--json']);
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe('');
    expect(JSON.parse(failure.stdout)).toStrictEqual({
        error: 'arguments',
        message:
            'The value [ is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('set leaves existing malformed settings classified as settings errors', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = [' });
    const before = await readTree(sandbox.path);
    const failure = await runGspot(sandbox.path, ['set', 'level', 'all', '--json']);
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe('');
    expect(JSON.parse(failure.stdout)).toMatchObject({ error: 'settings' });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
