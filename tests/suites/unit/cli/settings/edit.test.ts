import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildAvailableSettings } from '#cli/settings/available.ts';
import { addScopeTable, buildEditedSettings, removeKey, removeUnknownKeys, setKey } from '#cli/settings/edit.ts';
import { readSettingsFile } from '#cli/settings/file.ts';
import { buildSettingsFromTable } from '#cli/settings/parse.ts';
import type { GspotError } from '#cli/system/errors.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { INITIAL_SETTINGS, SCOPE_SETTING_WRITES, SEMGREP_IGNORE } from '#tests/config/settings/text.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('an edit writes the new ignore as a table and keeps the authored comment', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, '# Authored selection.\nconfigurations = ["security",]\n');
    const edit = readSettingsFile(sandbox.path);
    setKey(edit.table, 'ignore', [SEMGREP_IGNORE]);
    const proposed = buildEditedSettings(sandbox.path, edit);
    expect(proposed.text).toBe(
        '# Authored selection.\nconfigurations = ["security",]\n\n[[ignore]]\ncheck = "security/semgrep"\nrule = "js/file-system-race"\npaths = ["sample.js"]\nreason = "The sandbox owns its temporary files."\n',
    );
    await writeFile(path, proposed.text);
    const unchanged = readSettingsFile(sandbox.path);
    setKey(unchanged.table, 'ignore', [SEMGREP_IGNORE]);
    expect(buildEditedSettings(sandbox.path, unchanged).changed).toBe(false);
});

test('setting a nested key, then deleting it, removes the empty table', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, INITIAL_SETTINGS);
    const addedEdit = readSettingsFile(sandbox.path);
    setKey(addedEdit.table, 'limits.bash.max_file_lines', 100);
    const written = buildEditedSettings(sandbox.path, addedEdit).text;
    expect(written).toBe(`${INITIAL_SETTINGS}\n[limits]\nbash = { max_file_lines = 100 }\n`);
    await writeFile(path, written);
    const removedEdit = readSettingsFile(sandbox.path);
    removeKey(removedEdit.table, 'limits.bash.max_file_lines');
    const removed = buildEditedSettings(sandbox.path, removedEdit).text;
    expect(removed).toBe(INITIAL_SETTINGS);
});

test('removeUnknownKeys deletes the keys that no setting offers and returns them', () => {
    const table: TomlTable = { level: 'all', postgres: { assume_in_transaction: false }, tool_timeout_seconds: 600 };
    const removed = removeUnknownKeys(table, buildSettingsFromTable(table), buildAvailableSettings([], 'basic'));
    expect(removed).toStrictEqual(['postgres.assume_in_transaction']);
    expect(table).toStrictEqual({ level: 'all', tool_timeout_seconds: 600 });
});

test.each([...SCOPE_SETTING_WRITES])(
    'a scope setting written into %s loads with the settings already there',
    async (_form, scope) => {
        await using sandbox = await testdir();
        await writeFile(join(sandbox.path, 'gspot.toml'), `${INITIAL_SETTINGS}[[scope]]\npath = "api"\n${scope}\n`);
        const edit = readSettingsFile(sandbox.path);
        setKey(addScopeTable(edit.table, 'api'), 'limits.max_function_lines', 20);
        const result = buildEditedSettings(sandbox.path, edit);
        expect(result.settings.scopes.get('api')?.limits).toMatchObject({
            max_file_lines: 100,
            max_function_lines: 20,
        });
        await writeFile(join(sandbox.path, 'gspot.toml'), result.text);
        expect(readSettingsFile(sandbox.path).table['scope']).toMatchObject([
            { path: 'api', limits: { max_file_lines: 100, max_function_lines: 20 } },
        ]);
    },
);

test('an invalid edit reports the setting without inventing a saved line', async () => {
    await using sandbox = await testdir();
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        `${INITIAL_SETTINGS}# Authored limits.\n[limits]\nmax_file_lines = 100\n`,
    );
    const invalid = readSettingsFile(sandbox.path);
    setKey(invalid.table, 'limits.max_function_lines', 'long');
    expect(() => buildEditedSettings(sandbox.path, invalid)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'arguments',
            message:
                'limits.max_function_lines: The value "long" is not valid for limits.max_function_lines. Use a whole number of 0 or more.\nhttps://generativespotting.com/reference/gspot-toml/ lists every setting.',
        }),
    );
});

test('reordering keys does not change the file', async () => {
    await using sandbox = await testdir();
    const source = `${INITIAL_SETTINGS}level = "all"\n`;
    await writeFile(join(sandbox.path, 'gspot.toml'), source);
    const edit = readSettingsFile(sandbox.path);
    const configurations = edit.table['configurations'];
    delete edit.table['configurations'];
    edit.table['configurations'] = configurations;
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(source);
});

test('an edit writes a new list longer than format.print_width one item per line, as Taplo does', async () => {
    await using sandbox = await testdir({
        'gspot.toml': `${INITIAL_SETTINGS}\n[format]\nprint_width = 40\nindent_width = 2\n`,
    });
    const edit = readSettingsFile(sandbox.path);
    setKey(edit.table, 'naming.banned_words', ['alpha', 'beta']);
    setKey(edit.table, 'test_files', ['generated/first/**', 'generated/second/**']);
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(
        `${INITIAL_SETTINGS}test_files = [\n  "generated/first/**",\n  "generated/second/**",\n]\n\n[format]\nprint_width = 40\nindent_width = 2\n\n[naming]\nbanned_words = ["alpha", "beta"]\n`,
    );
});
