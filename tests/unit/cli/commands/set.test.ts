import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/tables.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { type SettingsListJson } from '#cli/types/commands/list.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, runGspotStep } from '#tests/setup/cli/commands.ts';

import {
    SET_REFUSALS,
    SET_SETTINGS,
    SETTING_REASON,
    LOOSENED_SETTINGS,
    NO_CHANGE_COMMANDS,
    BANNED_WORD_SCOPES,
    RESTRICTED_IMPORTS,
    SCOPE_BANNED_WORDS,
    STOPPED_APPLY_FILES,
    UNKNOWN_SETTING_KEYS,
    BANNED_WORD_SETTINGS,
    KEPT_SETTING_CHANGES,
} from '#tests/data/commands/set.ts';

test.each([...SET_REFUSALS])('set refuses %s', async (_, commandArguments, expected) => {
    await using sandbox = await testdir({
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
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe('arguments');
    expect(failure.message).toBe(expected);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...UNKNOWN_SETTING_KEYS])(
    'set refuses the unknown or unavailable key $key and writes nothing',
    async ({ key, message }) => {
        await using sandbox = await testdir({
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

test('set and unset work on a setting of a configuration that detection selects from package.json', async () => {
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
    const reset = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(getValueAt(reset, ['licenses', 'allowed'])).toBeUndefined();
});

test('set names -- when a value reads as an option, and takes the values after --', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    const refused = await runGspot(sandbox.path, ['set', 'ci.setup_command', 'bun', 'install', '--frozen-lockfile']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        "Unknown option '--frozen-lockfile'. To pass a value that starts with -, put -- before the values: gspot set ci.setup_command -- bun install --frozen-lockfile.\n",
    );
    const set = await runGspot(sandbox.path, ['set', 'ci.setup_command', '--', 'bun', 'install', '--frozen-lockfile']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    expect(set.stdout).not.toContain('(was undefined');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(getValueAt(written, ['ci', 'setup_command'])).toEqual(['bun', 'install', '--frozen-lockfile']);
});

test.each([...NO_CHANGE_COMMANDS])(
    '%s reports no change when gspot.toml already has the value',
    async (_name, commandArguments) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']) });
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout.split('\n', 1)[0]).toBe('No change: gspot.toml already has this value.');
    },
);

test.each([...KEPT_SETTING_CHANGES])(
    '%s keeps its change in gspot.toml and exits 2 when apply then stops',
    async (_, commandArguments, written, change) => {
        await using sandbox = await testdir(STOPPED_APPLY_FILES);

        const applied = await runGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const generated = join(sandbox.path, '.editorconfig');
        await chmod(generated, 0o644);
        await writeFile(generated, 'root = true\n');
        const stopped = await runGspot(sandbox.path, commandArguments);
        expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
        expect(stopped.stdout).toBe('');
        expect(stopped.stderr).toBe(
            `${change}\ngspot.toml keeps this change, and applying it stopped: These files were not overwritten by gspot: .editorconfig. Move them aside, then run the command again.\nFix that, then run gspot apply.\n`,
        );
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
    },
);

test.each([...BANNED_WORD_SCOPES])(
    'set writes naming.banned_words in the $name scope without installing tools, and unset removes them',
    async ({ scope, written }) => {
        await using sandbox = await testdir({
            'gspot.toml': BANNED_WORD_SETTINGS,
            'app/source.ts': 'export const active = true;\n',
        });
        const key = 'naming.banned_words';
        const scopeArguments = scope === '' ? [] : ['--scope', scope];
        const set = await runGspot(sandbox.path, ['set', key, ...SCOPE_BANNED_WORDS, ...scopeArguments]);
        expect(set.code, set.stdout + set.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(written);
        expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const reset = await runGspot(sandbox.path, ['unset', key, ...scopeArguments]);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(BANNED_WORD_SETTINGS);
    },
);

test('set writes a TOML list of tables as tables and refuses a value that is not a TOML inline value', async () => {
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
    expect(unreadable.stdout + unreadable.stderr).toBe(
        'The value [{name =  is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.\n',
    );
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
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    const changed = await runGspot(checkout, ['set', 'level', 'all']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(readSettings(checkout).settings.level).toBe('all');
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

/**
 * Create a Bash repository, apply, and commit the generated files for the fresh-clone tests.
 *
 * @param sourceRoot folder to initialize.
 */
async function prepareAppliedBashRepository(sourceRoot: string): Promise<void> {
    await createFileTree(sourceRoot, {
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    runGitStep(sourceRoot, ['init', '-q']);
    await runGspotStep({ root: sourceRoot, environment: {}, run: runGspot }, ['apply']);
    commitAll(sourceRoot);
}
test.each([...LOOSENED_SETTINGS])(
    'set refuses $key without --reason, and set and unset keep its reason through list edits',
    async ({ key, value, second }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', 'site'], { level: 'all' }),
            'entry.ts': 'export const port = 8080;\n',
        });
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, value]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toBe(
            `gspot.toml: ${key}.reason: ${key} needs a reason. Add \`reason = "..."\` to this record.\n`,
        );
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        for (const commandArguments of [
            ['set', key, value, '--reason', SETTING_REASON],
            ['set', key, second, '--reason', SETTING_REASON],
            ['unset', key, value],
        ]) {
            const result = await runGspot(sandbox.path, commandArguments);
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        const saved = getValueAt(
            parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable,
            key.split('.'),
        );
        expect(saved).toMatchObject({ value: [second], reason: SETTING_REASON });
    },
);
test('a reason on a value that does not loosen the default is refused before writing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {}),
        'entry.ts': 'export const port = 8080;\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['set', 'spelling.locale', 'en-gb', '--reason', SETTING_REASON]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toBe(
        'spelling.locale takes no reason here: the value does not loosen the shipped default. Run the command without --reason.\n',
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
test.each([...LOOSENED_SETTINGS])(
    '$key set in one scope keeps the root value, and unset gives the scope the inherited value again',
    async ({ key, value, second, defaults, appDefaults, siblingDefaults }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', 'site'], {
                level: 'all',
                tables: `${key} = { value = ${JSON.stringify([second])}, reason = ${JSON.stringify(SETTING_REASON)} }\n[[scope]]\npath = "app"\n[[scope]]\npath = "sibling"\n`,
            }),
            'entry.ts': 'export const port = 8080;\n',
            'app/entry.ts': 'export const port = 8081;\n',
            'sibling/entry.ts': 'export const port = 8082;\n',
        });
        const changed = await runGspot(sandbox.path, ['set', key, value, '--scope', 'app', '--reason', SETTING_REASON]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
        expect(getValueAt(saved, key.split('.'))).toMatchObject({ value: [second], reason: SETTING_REASON });
        const restored = await runGspot(sandbox.path, ['unset', key, '--scope', 'app']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const listed = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(listed.code, listed.stdout + listed.stderr).toBe(0);
        expect(
            (JSON.parse(listed.stdout) as SettingsListJson).settings
                .filter((row) => row.key === key)
                .map(({ value }) => value),
        ).toStrictEqual([
            [...defaults, second],
            [...appDefaults, second],
            [...siblingDefaults, second],
        ]);
    },
);
test('spelling.allowed_words keeps one reason for each word through edits', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'entry.ts': 'export const port = 8080;\n',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['set', 'spelling.allowed_words', 'Nebulix']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe(
        'spelling.allowed_words keeps a reason for each entry. Add --reason "..." with why each one belongs.\n',
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    for (const commandArguments of [
        ['set', 'spelling.allowed_words', 'Nebulix', '--reason', 'The product name stays as the vendor writes it.'],
        ['set', 'spelling.allowed_words', 'Quorbit', '--reason', SETTING_REASON],
        ['unset', 'spelling.allowed_words', 'Nebulix'],
    ]) {
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['spelling']).toStrictEqual({ allowed_words: { Quorbit: SETTING_REASON } });
});
